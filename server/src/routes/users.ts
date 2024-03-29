import emailValidator from 'email-validator';
import mysql from 'mysql2';

import route from '../';

import {
    addHousePointsToUser,
    AUTH_ERR, DEFAULT_EMAIL_DOMAIN,
    generateUUId, groupArr,
    idFromSession,
    isAdmin,
    isLoggedIn,
    passwordHash,
    validPassword
} from "../util";

/**
 * @admin
 * Gets all users
 * @param userId
 * @param email
 * @param sessionId
 */
route('get/users', async ({ query, body }) => {
    if (!await isLoggedIn(body, query)) return AUTH_ERR;
    
    const { userId = <unknown>'', email = <unknown>'', sessionId = <unknown>'', session } = body;
    
    if (typeof session !== 'string') return AUTH_ERR;

    if (sessionId) {
        if (userId) return `Invalid body: cannot specify both 'session' and 'id'`;
        if (email) return `Invalid body: cannot specify both 'session' and 'email'`;

        const data = await query`
            SELECT
                users.id,
                users.email,
                users.admin,
                users.student,
                users.year
            FROM users, sessions
            WHERE sessions.id = ${sessionId}
                AND sessions.userId = users.id
                AND UNIX_TIMESTAMP(sessions.opened) + sessions.expires > UNIX_TIMESTAMP()
                AND sessions.active = 1
        `;

        if (!data.length)
            return {
                status: 406,
                error: 'User not found'
            };

        const user = data[0];

        await addHousePointsToUser(query, user);

        return user;
    }

    if (email) {
        if (userId) return `Invalid body: cannot specify both 'email' and 'id'`;
        if (!(await isLoggedIn(body, query))) return AUTH_ERR;

        const { email } = body;

        if (!email) return 'No email';

        const data = await query`
            SELECT 
                id,
                email,
                admin,
                student,
                year
            FROM users
            WHERE email = ${email}
        `;
        if (!data[0])
            return {
                status: 406,
                error: 'User not found'
            };

        const user = data[0];

        await addHousePointsToUser(query, user);

        // censor the data if they don't have access
        if (!(await isAdmin(body, query))) {
            const id = await idFromSession(query, session);
            if (id !== user.id) {
                delete user.id;

                for (let hp of user['housePoints']) {
                    delete hp.id;
                    delete hp.userId;
                    delete hp.rejectMessage;
                }
            }
        }

        return user;
    }

    // gets all users
    if (!userId) {
        if (!(await isAdmin(body, query))) return AUTH_ERR;

        const data = await query`
            SELECT 
                id,
                email, 
                year,
                admin,
                student
            FROM users
            ORDER BY
                student,
                admin DESC,
                year,
                email
        `;

        // add house points to all users without waiting for one user to finish
        await Promise.all(
            data.map(async (user: any) => {
                await addHousePointsToUser(query, user);
            })
        );

        return { data };
    }

    // user with specific Id
    const data = await query`
        SELECT 
            id,
            email,
            admin,
            student,
            year
        FROM users
        WHERE id = ${userId}
    `;

    if (!data.length)
        return {
            status: 406,
            error: 'User not found'
        };

    const user = data[0];

    await addHousePointsToUser(query, user);

    return user;
});

/**
 * @admin
 * Gets the details of multiple users from a list of Ids.
 * Ids are delimited by ','
 * @param {string[]} userIds
 */
route('get/users/batch-info', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { userIds: ids } = body;

    if (!(ids as any)?.length)
        return {
            status: 406,
            error: `Invalid 'userIds' parameter`
        };

    const data = await query`
        SELECT 
            id,
            admin,
            student,
            email,
            year
        FROM users
        WHERE id IN (${ids})
    `;

    for (let i = 0; i < data.length; i++) {
        await addHousePointsToUser(query, data[i]);
    }

    return { data };
});

/**
 * @admin
 */
route('get/users/wants-award', async ({ query, body }) => {
    if (!await isAdmin(body, query)) return AUTH_ERR;
    
    const data = await query`
    
        SELECT
            table2.id,
            table2.email,
            table2.year,
            table2.awardType AS awardTypeId,
            table2.hpsRequired AS awardRequires,
            table2.points AS accepted,
            table2.topAward AS awardName
        FROM
            (
                SELECT
                    users.id,
                    users.email,
                    users.year,
                    SUM(housepoints.quantity) AS points,
                    table1.name AS topAward,
                    table1.hpsRequired AS hpsRequired,
                    table1.awardType
                FROM
                    housepoints,
                    users
                        LEFT JOIN (
                        SELECT
                            users.id,
                            awardTypes.id AS awardType,
                            awardTypes.name,
                            MAX(hpsRequired) AS hpsRequired
                        FROM
                            awardTypes,
                            users
                                LEFT JOIN awards
                                    ON users.id = awards.userid
                        GROUP BY
                            users.id,
                            awardType,
                            awardTypes.name
                    ) AS table1
                        ON table1.id = users.id
                WHERE
                    housepoints.status = 'Accepted'
                  AND housepoints.userId = users.id
                  AND table1.id = users.id
                GROUP BY
                    users.id,
                    users.email,
                    users.year,
                    table1.name,
                    table1.hpsRequired,
                    table1.awardType
            ) AS table2
        WHERE
            points >= hpsRequired
          AND (table2.id, table2.awardType) NOT IN (
            SELECT awards.userId, awards.awardTypeId
            FROM awards
        )
        ORDER BY hpsRequired - points, year DESC, email
    `;
    
    // stupid thing: https://github.com/sidorares/node-mysql2/issues/935
    for (let i = 0; i < data.length; i++) {
        data[i].accepted = parseInt(data[i]?.accepted);
    }
    
    return { data };
});

/**
 * @account
 * Gets the data required for to make the leaderboard.
 */
route('get/users/leaderboard', async ({ query, body }) => {
    if (!(await isLoggedIn(body, query))) return AUTH_ERR;

    let data = await query`
        SELECT
            id,
            email,
            admin,
            student,
            year
        FROM users
        WHERE student = true
        ORDER BY year DESC, email
    `;
    
    for (let i = 0; i < data.length; i++) {
        await addHousePointsToUser(query, data[i]);
    }

    if (!(await isAdmin(body, query))) {
        // remove id from each user
        for (let i = 0; i < data.length; i++) {
            delete data[i]?.['id'];
        }
    }

    data = data.sort((a, b) => b['accepted'] - a['accepted']);
    
    const groupedData = groupArr(data, 'year');
    
    data = [];
    
    for (let year in groupedData) {
        // only get the first 10 people in each year
        data.push(...groupedData[year].slice(0, 10));
    }
    
    // re-sort as grouping and ungrouping shuffles it
    data = data.sort((a, b) => b['accepted'] - a['accepted']);
    
    return { data };
});

/**
 * @admin
 * Creates an account from an email and password.
 * Note admin - students cannot create their own accounts
 * Generates a salt and Id for the student.
 * Hashes the password along with the salt before storing it in the DB.
 *
 * @param {(13 >= number >= 9) || (number == 0)} year - year of student
 *                                                      if the year is 0 then it is a
 *                                                      non-student (teacher) account,
 *                                                      and they are assumed to be an admin
 * @param email
 * @param password
 */
route('create/users', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    let { email = '', year = 9, password = '', admin=false } = body;

    if (!Number.isInteger(year) || typeof year !== 'number') {
        return `Year is not a number`;
    }
    if ((year < 9 || year > 13) && year !== 0) {
        return `Year '${year}' is not between 9 and 13`;
    }
    
    if (typeof admin !== 'boolean') {
        return `'Admin' is not a boolean`;
    }
    
    if (typeof email !== 'string') {
        return `Invalid email`;
    }
    
    if (!email.includes('@')) {
        email = email + '@' + DEFAULT_EMAIL_DOMAIN;
    }

    if (!emailValidator.validate(email as string)) {
        return `Invalid email`;
    }

    let currentUser = await query`
        SELECT id FROM users WHERE email = ${email}
    `;
    if (currentUser.length) {
        return `User with that email already exists`;
    }

    if (typeof password !== 'string') return `Invalid password`;
    const validPasswordRes = validPassword(password);
    if (typeof validPasswordRes === 'string') {
        return validPasswordRes;
    }
    
    const student = year === 0 ? 0 : 1;

    const [ passHash, salt ] = passwordHash(password);

    const userId = await generateUUId('user');

    await query`
        INSERT INTO users
            (  id,        email,    password,    salt,    year,    admin,    student)
        VALUES
            (${userId}, ${email}, ${passHash}, ${salt}, ${year}, ${admin}, ${student})
    `;

    return { status: 201, userId };
});

/**
 * @admin
 * Change a user's admin status from their Id.
 * If the userId is the same as the Id associated with the session in cookies
 * it returns an error.
 * Otherwise, you could remove all admins from the system.
 *
 * @param {1|any} admin - whether they should be an admin now.
 *                        1 for admin, anything else for not admin.
 * @param userId
 */
route('update/users/admin', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { userId = '', admin = false, session: mySession } = body;
    
    if (!mySession) return 'No session Id found';
    if (typeof mySession !== 'string') {
        return 'Session Id is not a string';
    }

    if (typeof admin !== 'boolean') {
        return 'Must specify admin in body';
    }

    if ((await idFromSession(query, mySession)) === userId)
        return {
            status: 403,
            error: 'You cannot change your own admin status'
        };

    const queryRes = await query<mysql.OkPacket>`
        UPDATE users
        SET admin = ${admin}
        WHERE id = ${userId}
   `;
    if (!queryRes.affectedRows)
        return {
            status: 406,
            error: 'User not found'
        };
});

/**
 * @admin
 * Update a student's year.
 * Needed for when everyone goes up a year.
 * Changes a students year by an amount between -3 and 3 and not 0
 * Cannot change a non-student's year from 0
 * @param userId
 * @param {int} by
 */
route('update/users/year', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { userId: user = '', by: yearChange } = body;

    if (!Number.isInteger(yearChange) || typeof yearChange !== 'number') {
        return `Year change is not an integer`;
    }

    const currentYear = await query`
        SELECT year 
        FROM users 
        WHERE id = ${user}
    `;
    if (!currentYear[0])
        return {
            status: 406,
            error: 'User not found'
        };

    const newYear = currentYear[0].year + yearChange;

    if (newYear > 13 || newYear < 9) {
        return `Cannot change year to ${newYear}, must be between 8 and 13`;
    }

    const queryRes = await query<mysql.OkPacket>`
        UPDATE users
        SET year = ${newYear}
        WHERE id = ${user}
    `;

    if (!queryRes.affectedRows)
        return {
            status: 406,
            error: 'User not found'
        };
});

/**
 * Updates the password from a session Id and new password.
 * This is a high risk route, as you are updating the password of a user,
 * and this must be able to be done by a user without login details
 * if they are using the 'forgot password' feature.
 * @param sessionId
 * @param newPassword
 */
route('update/users/password', async ({ query, body }) => {
    const { sessionId = '', newPassword = '' } = body;

    if (typeof sessionId !== 'string') {
        return 'Session Id is not a string';
    }
    const userId = await idFromSession(query, sessionId);

    if (!userId)
        return {
            status: 401,
            error: 'Invalid session Id'
        };
    
    if (typeof newPassword !== 'string'){
        return 'Password must be a string';
    }
    const validPasswordRes = validPassword(newPassword);
    if (typeof validPasswordRes === 'string') {
        return validPasswordRes;
    }

    const [passHash, salt] = passwordHash(newPassword);

    const queryRes = await query<mysql.OkPacket>`
        UPDATE users
        SET
            password = ${passHash},
            salt = ${salt}
        WHERE id = ${userId}
    `;

    if (!queryRes.affectedRows)
        return {
            status: 406,
            error: 'User not found'
        };

    await query`
        UPDATE sessions
        SET active = 0
        WHERE
            id = ${sessionId}
            OR UNIX_TIMESTAMP(opened) + expires > UNIX_TIMESTAMP()
    `;
});

/**
 * @admin
 * Deletes a user from a user Id
 * @param userId
 */
route('delete/users', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { userId, session } = body;

    if (typeof session !== 'string') {
        return 'Session Id is not a string';
    }
    if ((await idFromSession(query, session)) === userId)
        return {
            status: 403,
            error: 'You cannot delete your own account'
        };

    await query`
        DELETE FROM housepoints
        WHERE userId = ${userId}
    `;
    await query`
        DELETE FROM awards
        WHERE userId = ${userId}
    `;

    const queryRes = await query<mysql.OkPacket>`
        DELETE FROM users
        WHERE id = ${userId}
    `;
    if (!queryRes.affectedRows)
        return {
            status: 406,
            error: 'User not found'
        };
});
