import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { v4 as UUIdv4 } from 'uuid';
import crypto from 'crypto';
import log from "./log";
import { queryFunc } from './sql';

// CONSTANTS
/**
 * Object to return from a route if incorrect credentials were provided.
 * Frozen (immutable) and constant.
 * */
export const AUTH_ERR: Readonly<{
    error: string;
    status: number;
}> = Object.freeze({
    error: 'You are not authorized for this action',
    status: 401
});

export const DEFAULT_EMAIL_DOMAIN = 'kingsely.org';


// FUNCTIONS

/**
 * Limits the length of a string by cutting it and adding '...'
 * to the end if it's too long
 */
export function limitStr(str: string, maxLength = 50) {
    if (str.length > maxLength - 3) {
        return str.substring(0, maxLength - 3) + '...';
    }
    return str;
}

/**
 * @src https://stackoverflow.com/questions/14446511/most-efficient-method-to-groupby-on-an-array-of-objects
 * @example
 * groupArr(['one', 'two', 'three'], 'length');
 * // => {"3": ["one", "two"], "5": ["three"]}
 */
export function groupArr <T>(arr: T[], key: string): Record<string, T[]> {
    return arr.reduce(function(rv: any, x: any) {
        (rv[x[key]] = rv[x[key]] || []).push(x);
        return rv;
    }, {});
}

/**
 * Reduces the parameters to a template string (tag) function into a single string
 * @example
 * t`1 ${2} 3` => t('1 2 3')
 */
export function tagFuncParamsToString(msg: string | TemplateStringsArray, params: any[]): string {
    if (typeof msg === 'string') {
        return msg;
    }

    return msg.reduce((acc, cur, i) => {
        if (typeof params[i] === 'object') {
            params[i] = JSON.stringify(params[i]);
        }
        let paramStr = (params[i] || '').toString();
        return acc + cur + paramStr;
    }, '');
}

/**
 * Checks to see if an object is JSON-parsable.
 * Note that this is expensive for large JSON strings
 */
export function isJson(item: unknown): boolean {
    if (typeof item !== 'string') {
        return false;
    }

    try {
        item = JSON.parse(item);
    } catch (e) {
        return false;
    }

    return item !== null;
}

/**
 * Removes ANSI escape codes from a string so that it is not coloured.
 */
export function removeColour(str: string): string {
    return str.replace(
        /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
        ''
    );
}

/**
 * Loads env from path
 * (relative to '/server'. or more specifically, the directory containing the server JS file)
 */
export function loadEnv(filePath = '.env'): void {
    log.log`Loading env from ${filePath}`;
    // file path relative to this file
    filePath = path.join(path.resolve(__dirname), filePath);
    const contents = fs.readFileSync(filePath, 'utf8');

    process.env = {
        ...process.env,
        ...dotenv.parse(contents)
    };
}

// DB Query helpers

/**
 * Gets the authorisation level of a user from their code
 * 0: not signed in
 * 1: normal student
 * 2: admin
 */
export async function authLvl(sessionId: string, query: queryFunc) {
    if (!sessionId) return 0;

    const res = await query`
        SELECT users.admin
        FROM sessions, users
        WHERE sessions.id = ${sessionId}
            AND sessions.userId = users.id
            AND UNIX_TIMESTAMP(sessions.opened) + sessions.expires > UNIX_TIMESTAMP()
            AND sessions.active = 1
    `;

    if (!res.length) return 0;

    const [user] = res;

    return user?.['admin'] === 1 ? 2 : 1;
}

/**
 * True if user code is valid
 */
export async function isLoggedIn(body: any, query: queryFunc): Promise<boolean> {
    return (await authLvl(body.session, query)) > 0;
}

/**
 * True if user code is valid and an admin
 */
export async function isAdmin(body: any, query: queryFunc): Promise<boolean> {
    return (await authLvl(body.session, query)) >= 2;
}

/**
 * Decode URL parameter
 * @param {string} param
 */
export function decodeParam(param: string): string {
    return decodeURIComponent(param.replace(/\+/g, ' '));
}

/**
 * Generate a random UUId using UUId v4 generator.
 * Does not check for collisions at the moment, but should be fine.
 */
export async function generateUUId(type: string): Promise<string> {
    return `hp-${type}-${UUIdv4()}`;
}

/**
 * Hashes a password using 'sha256' and generates a salt for it.
 * @param {string} password
 * @returns {string[]}
 */
export function passwordHash(password: string) {
    const salt = crypto.randomBytes(16).toString('base64');

    const passwordHash = crypto
        .createHash('sha256')
        .update(password + salt)
        .digest('hex');

    return [ passwordHash, salt ];
}

/**
 * Check that a password string provided meets certain security requirements.
 * @param {string} password
 * @returns {true | string}
 */
export function validPassword(password: string): true | string {
    if (!password) return 'No password';
    if (password.length < 5) return 'Password is too short, must be over 4 characters';
    if (password.length > 64) return 'Password is too long, must be under 64 characters';

    return true;
}

/**
 * Gets the userId from a session id
 */
export async function idFromSession(query: queryFunc, sessionId: string): Promise<string> {
    const res = await query`
        SELECT userId
        FROM sessions
        WHERE
            id = ${sessionId}
        AND UNIX_TIMESTAMP(opened) + expires > UNIX_TIMESTAMP()
    `;

    if (!res.length) return '';

    return res?.[0]?.['userId'] || '';
}

/**
 * Gets the user id from a body object
 */
export async function userId(body: any, query: queryFunc) {
    return idFromSession(query, body?.session || '');
}

/**
 * Gets the user details from a user id
 */
export async function userFromId(
    query: queryFunc,
    id: unknown
): Promise<Record<string, any> | null> {
    if (typeof id !== 'string') return null;
    if (!id) return null;
    
    const res = await query`
        SELECT
            id,
            email,
            year,
            admin,
            student
        FROM users
        WHERE id = ${id}
    `;

    if (!res[0]) return null;

    await addHousePointsToUser(query, res[0]);

    return res[0];
}

/**
 * Gets the user details from a session token
 */
export async function userFromSession(
    query: queryFunc,
    id: unknown
): Promise<Record<string, any> | null> {
    if (typeof id !== 'string') return null;
    if (!id) return null;
    
    const res = await query`
        SELECT
            users.id,
            users.email,
            users.year,
            users.admin,
            users.student
        FROM users, sessions
        WHERE
            sessions.userId = users.id
            
            AND sessions.id = ${id}
            AND UNIX_TIMESTAMP(opened) + expires > UNIX_TIMESTAMP()
    `;

    if (!res[0]) return null;

    await addHousePointsToUser(query, res[0]);

    return res[0];
}

/**
 * Adds house point details to a user
 * Adds 'housePoints', 'accepted', 'rejected', 'pending' keys to the user object.
 * Assumed admin level authentication, censor the data after if necessary.
 */
export async function addHousePointsToUser(query: queryFunc, user: any & { id: string }) {
    if (!user['id'] || typeof user.id !== 'string') {
        throw new Error('Invalid user ID: ' + user.id);
    }

    user['housePoints'] = await query`
        SELECT
            housepoints.id,
            housepoints.quantity,
            housepoints.description,
            housepoints.status,
            UNIX_TIMESTAMP(housepoints.created) as created,
            UNIX_TIMESTAMP(housepoints.completed) as completed,
            housepoints.rejectMessage,
            
            users.id as userId,
            users.email as userEmail,
            users.year as userYear,
            
            housepoints.eventId as eventId,
            events.name as eventName,
            events.description as eventDescription,
            UNIX_TIMESTAMP(events.time) as eventTime
            
        FROM users, housepoints
        LEFT JOIN events
        ON events.id = housepoints.eventId
        
        WHERE
            housepoints.userId = users.id
            AND users.id = ${user['id']}
       ORDER BY created DESC
    `;
    
    user['awards'] = await query`
        SELECT
            awards.id,
            UNIX_TIMESTAMP(awards.awarded) as awarded,
            awards.description,
            
            awardTypes.id as awardTypeId,
            awardTypes.name as awardTypeName,
            awardTypes.description as awardTypeDescription,
            awardTypes.hpsRequired as awardRequirement,
            awardTypes.icon as icon,
            
            users.id as userId,
            users.email as userEmail,
            users.year as userYear
            
        FROM users, awards, awardTypes
        
        WHERE
            awards.userId = users.id
            AND awards.awardTypeId = awardTypes.id
            AND users.id = ${user['id']}
       ORDER BY awarded DESC
    `;

    // add the quick count stats
    user['accepted'] ??= user['housePoints'].reduce(
        (acc: number, hp: any) => acc + (hp['status'] === 'Accepted' ? hp['quantity'] : 0),
        0
    );

    user['pending'] ??= user['housePoints'].reduce(
        (acc: number, hp: any) => acc + (hp['status'] === 'Pending' ? hp['quantity'] : 0),
        0
    );

    user['rejected'] ??= user['housePoints'].reduce(
        (acc: number, hp: any) => acc + (hp['status'] === 'Rejected' ? hp['quantity'] : 0),
        0
    );

    // user passed by reference as it's an object so don't need to return anything
}

/**
 * Adds house point details to a user
 * Adds 'housePoints', 'accepted', 'rejected', 'pending' keys to the user object.
 * Assumed admin level authentication, censor the data after if necessary.
 */
export async function addHousePointsToEvent(query: queryFunc, event: any & { id: string }) {
    if (!event['id']) {
        throw new Error('User has no Id');
    }

    event['housePoints'] = await query`
        SELECT
            housepoints.id,
            housepoints.quantity,
            housepoints.description,
            housepoints.status,
            UNIX_TIMESTAMP(housepoints.created) as created,
            UNIX_TIMESTAMP(housepoints.completed) as completed,
            housepoints.rejectMessage,
            
            users.id as userId,
            users.email as userEmail,
            users.year as userYear,
            
            housepoints.eventId as eventId,
            events.name as eventName,
            events.description as eventDescription,
            UNIX_TIMESTAMP(events.time) as eventTime
            
        FROM users, housepoints
        LEFT JOIN events
        ON events.id = housepoints.eventId
        
        WHERE
            housepoints.userId = users.id
            AND events.id = ${event['id']}
       ORDER BY created DESC
    `;

    event['housePointCount'] = event['housePoints'].reduce(
        (acc: any, cur: any) => acc + cur['quantity'],
        0
    );

    // event passed by reference as it's an object so don't need to return anything
}
