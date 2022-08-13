import route from "../";
import {
    AUTH_ERR,
    generateUUID,
    isAdmin,
    isLoggedIn,
    userFromID,
    userFromSession,
    userID
} from '../util';
import mysql from "mysql2";
import * as notifications from '../notifications';

const MAX_HOUSE_POINTS = 100;

/**
 * @account
 * Gets all house points and filters them based on the parameters
 *
 * @param {string} id - house points with this ID
 * @param {string} userID - house points with a user=userID
 * @param {13 >= number >= 9} yearGroup - house points earned by a student in this year group
 * @param {'Accepted'|'Pending'|'Rejected'} status - house points with this status
 * @param {number} from - house points created after this timestamp
 * @param {number} to - house points created before this timestamp
 */
route('get/house-points', async ({ query, body }) => {
    if (!await isLoggedIn(body, query)) return AUTH_ERR;

    let { id='', userID='', yearGroup: ygRaw='', status='', from: fromRaw='', to: toRaw='' } = body;

    let yearGroup = parseInt(ygRaw) || 0;
    let from = parseInt(fromRaw) || 0;
    let to = parseInt(toRaw) || 0;

    const res = await query`
        SELECT
            housepoints.id,
            housepoints.quantity,
            housepoints.description,
            housepoints.status,
            UNIX_TIMESTAMP(housepoints.created) as created,
            UNIX_TIMESTAMP(housepoints.completed) as completed,
            housepoints.rejectMessage,
            
            users.id as userID,
            users.email as studentEmail,
            users.year as studentYear,
            
            housepoints.event as eventID,
            events.name as eventName,
            events.description as eventDescription,
            UNIX_TIMESTAMP(events.time) as eventTime
            
        FROM users, housepoints
        LEFT JOIN events
        ON events.id = housepoints.event
        
        WHERE
            housepoints.student = users.id
            
            AND ((housepoints.id = ${id})         OR ${!id})
            AND ((users.id = ${userID})           OR ${!userID})
            AND ((housepoints.status = ${status}) OR ${!status})
            AND ((users.year = ${yearGroup})      OR ${!yearGroup})
            AND ((created >= ${from})             OR ${!from})
            AND ((created <= ${to})               OR ${!to})
            
        ORDER BY created DESC
    `;

    // either require admin or the house point to belong to the user
    if (!await isAdmin(body, query)) {
        const user = await userFromSession(query, body.session);
        if (!user) return AUTH_ERR;
        if (!user['id']) return AUTH_ERR;

        for (let i = 0; i < res.length; i++) {
            if (res[i]['userID'] === user['id']) {
                continue;
            }

            // if the house point does not belong to the user, censor it
            delete res[i]['userID'];
            delete res[i]['studentEmail'];
            delete res[i]['rejectMessage'];
            delete res[i]['description'];
        }
    }

    return { data: res };
});

/**
 * @admin
 * @notification
 * Gives a house point to the student with that userID
 *
 * @param {string} description - description of house point
 * @param {string} event - id of event house points should be associated with
 * @param description
 * @param event
 */
route('create/house-points/give', async ({ query, body }) => {
    if (!await isAdmin(body, query)) return AUTH_ERR;

    const { userID='', description='', event='', quantity: rawQuantity='' } = body;

    let student = await userFromID(query, userID);
    if (!student) return `Student with ID '${userID}' not found`;
    if (!student['student']) return 'Can only give house points to students';

    let quantity = parseInt(rawQuantity);
    if (isNaN(quantity) || !quantity) {
        return 'Quantity must be an integer';
    }
    if (quantity < 1) {
        return 'Quantity must be at least 1';
    }
    if (quantity > MAX_HOUSE_POINTS) {
        return `Quantity must be at most ${MAX_HOUSE_POINTS}`;
    }

    await query`
        INSERT INTO housepoints (id, student, quantity, event, description, status, completed)
        VALUES (
            ${await generateUUID()},
            ${userID},
            ${quantity},
            ${event},
            ${description || ''},
            'Accepted',
            CURRENT_TIMESTAMP
        )
    `;

    let notifRes = await notifications.receivedHousePoint(query, userID, quantity);
    if (notifRes !== true) return notifRes;

    return { status: 201 };
});

/**
 * @account
 * Creates a house points request.
 * All users can do this.
 * This house point can be GET but does not count towards any house points counts
 * @param userID
 * @param {int?} quantity
 * @param description
 * @param event
 */
route('create/house-points/request', async ({ query, body }) => {
    if (!await isLoggedIn(body, query)) return AUTH_ERR;

    const { userID='', description='', event='', quantity: rawQuantity='' } = body;

    let quantity = parseInt(rawQuantity);
    if (isNaN(quantity) || !quantity) {
        return 'Quantity must be an integer';
    }
    if (quantity < 1) {
        return 'Quantity must be greater than 0';
    }
    if (quantity > MAX_HOUSE_POINTS) {
        return `Quantity must be at most ${MAX_HOUSE_POINTS}`;
    }

    let student = await userFromID(query, userID);
    if (!student) return `Student with ID '${userID}' not found`;
    if (!student.student) return 'Can only give house points to students';

    if (event) {
        // check event exists
        let eventData = await query`
            SELECT id
            FROM events
            WHERE events.id = ${event}
        `;
        if (!eventData.length) return 'Event not found';

        // check that they are not already in the event.
        const usersInEvent = await query`
            SELECT users.id
            FROM users
            LEFT JOIN housepoints
            ON housepoints.student = users.id
            WHERE housepoints.event = ${event}
        `;
        if (usersInEvent.filter(u => u.id === userID).length) {
            return 'User is already in event';
        }
    }

    await query`
        INSERT INTO housepoints (id, student, quantity, event, description, status)
        VALUES (
            ${await generateUUID()},
            ${userID},
            ${quantity},
            ${event},
            ${description},
            'Pending'
        )
    `;

    return { status: 201 };
});

/**
 * @admin
 * @notification
 * Updates the status of the house points.
 * You cannot change a house point from 'Accepted' or 'Rejected' to any other status,
 * only from 'Pending'.
 * This route is the only way to change the status of a house point.
 * Takes a house point ID
 *
 * @param {string} reject - If present, rejects the house points instead of accepting it.
 *                          This is the message shown to the student for why the HP was rejected.
 * @param housePointID
 */
route('update/house-points/accepted', async ({ query, body }) => {
    if (!await isAdmin(body, query)) return AUTH_ERR;

    const { housePointID: id='', reject='' } = body;

    const hps = await query`
        SELECT
            housepoints.status,
            housepoints.description,
            users.email,
            users.id as userID
        FROM housepoints, users
        WHERE housepoints.id = ${id}
            AND housepoints.student = users.id
    `;

    if (!hps.length) return {
        status: 406,
        error: `No house point found with that ID`
    };

    const hp = hps[0];

    if (hp.status !== 'Pending') return {
        status: 406,
        error: `House point with is not 'Pending', is '${hp.status}'`
    };

    if (reject) {
        await query`
            UPDATE housepoints 
            SET 
                rejectMessage = ${reject},
                completed = CURRENT_TIMESTAMP,
                status = 'Rejected'
            WHERE id = ${id}
        `;
    } else {
        await query`
            UPDATE housepoints
            SET
                completed = CURRENT_TIMESTAMP,
                status = 'Accepted'
            WHERE id = ${id}
        `;
    }

    let notifRes = await notifications.housePointRequestAcceptedOrRejected(query, hp['userID'], hp['description'], reject);
    if (notifRes !== true) return notifRes;
});

/**
 * @admin
 * Updates the quantity of a house point
 *
 * @param housePointID
 * @param {int} quantity
 */
route('update/house-points/quantity', async ({ query, body }) => {
    if (!await isAdmin(body, query)) return AUTH_ERR;

    const { housePointID: id='', quantity: rawQuantity='' } = body;

    const quantity = parseInt(rawQuantity);
    if (isNaN(quantity)) {
        return 'Quantity must be an integer';
    }
    if (quantity < 1) {
        return 'Quantity must be greater than 0';
    }
    if (quantity > MAX_HOUSE_POINTS) {
        return `Quantity must be at most ${MAX_HOUSE_POINTS}`;
    }


    const queryRes = await query<mysql.OkPacket>`
        UPDATE housepoints
        SET quantity = ${quantity}
        WHERE id = ${id}
    `;

    if (!queryRes.affectedRows) return {
        status: 406,
        error: `No house point found with ID '${id}'`
    };
});

/**
 * @admin
 * Updates the creation time of the house point
 * @param housePointID
 * @param {int} timestamp
 */
route('update/house-points/timestamp', async ({ query, body }) => {
    if (!await isAdmin(body, query)) return AUTH_ERR;

    const { housePointID: id='', quantity: rawQuantity='' } = body;

    const quantity = parseInt(rawQuantity);
    if (isNaN(quantity)) {
        return 'Quantity must be an integer';
    }
    if (quantity < 1) {
        return 'Quantity must be greater than 0';
    }
    if (quantity > MAX_HOUSE_POINTS) {
        return `Quantity must be at most ${MAX_HOUSE_POINTS}`;
    }

    const queryRes = await query<mysql.OkPacket>`
        UPDATE housepoints
        SET quantity = ${quantity}
        WHERE id = ${id}
    `;

    if (!queryRes.affectedRows) return {
        status: 406,
        error: `No house point found with ID '${id}'`
    };
});

/**
 * @admin
 * Deletes a house point from a house point ID
 * @param housePointID
 */
route('delete/house-points/with-id', async ({ query, body }) => {
    const { housePointID: id='' } = body;

    // if we aren't an admin user, we can still delete it if
    // they own the house point
    if (!await isAdmin(body, query)) {
        if (!await isLoggedIn(body, query)) return AUTH_ERR;

        const res = await query`
            SELECT users.id
            FROM housepoints, users
            WHERE housepoints.id = ${id}
              AND housepoints.student = users.id
        `;

        // doesn't get to know if house point even exists or not
        if (!res.length) return AUTH_ERR;
        if (res[0]['id'] !== await userID(body, query)) {
            return AUTH_ERR;
        }
    }

    const res = await query<mysql.OkPacket>`
        DELETE FROM housepoints 
        WHERE id = ${id}
    `;
    if (!res.affectedRows) return {
        status: 406,
        error: `No house points to delete with ID '${id}'`
    }
});
