import route from '../';
import { AUTH_ERR, generateUUId, isAdmin, isLoggedIn } from '../util';
import mysql from 'mysql2';

/**
 * @account
 * No options as you always want all of them
 */
route('get/award-types', async ({ query, body }) => {
    if (!(await isLoggedIn(body, query))) return AUTH_ERR;

    return {
        data: await query`
            SELECT
                id,
                name,
                description,
                hpsRequired
            FROM awardTypes
        `
    };
});

/**
 * @admin
 * @param name
 * @param required
 * @param description
 */
route('create/award-types', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { name = '', required = -1, description = '' } = body;

    if (!name) return 'Missing parameter name';
    if (!Number.isInteger(required) || required < 0) {
        return 'Invalid house point requirement';
    }

    const id = await generateUUId();

    await query`
        INSERT INTO awardTypes (
            id,
            name,
            description,
            hpsRequired
        ) VALUES (
            ${id},
            ${name},
            ${description},
            ${required}
        )
    `;

    return {
        id,
        status: 201
    };
});

/**
 * @admin
 * @param awardTypeId
 * @param newName
 */
route('update/award-types/name', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { awardTypeId: id = '', name = '' } = body;

    if (!id) return 'Missing parameter id';
    if (!name) return 'Missing parameter name';

    const queryRes = await query<mysql.OkPacket>`
        UPDATE awardTypes
        SET name = ${name}
        WHERE id = ${id}
    `;

    if (queryRes.affectedRows === 0)
        return {
            status: 406,
            error: `No Award Types to delete with that Id`
        };
});

/**
 * @admin
 * @param awardTypeId
 * @param {int} newQuantity
 */
route('update/award-types/hps-required', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { awardTypeId: id = '', quantity = -1 } = body;

    if (!id) return 'Missing parameter id';
    if (!Number.isInteger(quantity) || quantity < 0) {
        return 'Invalid house point requirement';
    }

    const queryRes = await query<mysql.OkPacket>`
        UPDATE awardTypes
        SET hpsRequired = ${quantity}
        WHERE id = ${id}
    `;

    if (queryRes.affectedRows === 0)
        return {
            status: 406,
            error: `No Award Types found that Id`
        };
});

/**
 * @admin
 * @param awardTypeId
 * @param newDescription
 */
route('update/award-types/description', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    const { awardTypeId: id = '', description = '' } = body;

    if (!id) return 'Missing parameter id';
    if (!description) return 'Missing parameter description';

    const queryRes = await query<mysql.OkPacket>`
        UPDATE awardTypes
        SET description = ${description}
        WHERE id = ${id}
    `;

    if (queryRes.affectedRows === 0)
        return {
            status: 406,
            error: `No Award Types to delete with that Id`
        };
});

/**
 * @admin
 * @param awardTypeId
 */
route('delete/award-types', async ({ query, body }) => {
    if (!(await isAdmin(body, query))) return AUTH_ERR;

    if (!body.awardTypeId) return 'Missing parameter id';

    const queryRes = await query<mysql.OkPacket>`
        DELETE FROM awardTypes
        WHERE id = ${body.awardTypeId}
    `;

    if (queryRes.affectedRows === 0)
        return {
            status: 406,
            error: `No Award Types to delete with that Id`
        };
});
