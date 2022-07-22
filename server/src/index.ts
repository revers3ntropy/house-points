import https from "https";
import http from "http";
import * as fs from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import commandLineArgs from 'command-line-args';
import c from 'chalk';

import { type Handler, Route } from "./route";
import connectSQL, { type queryFunc } from './sql';
import log, { error, LogLvl, setLogOptions, warning, close as stopLogger } from "./log";
import { loadEnv, parseCookies } from "./util";

export const flags = commandLineArgs([
    { name: 'dev', alias: 'd', type: Boolean, defaultValue: false },
    { name: 'log', type: Number, defaultValue: LogLvl.ALL },
    { name: 'logTo', type: String, defaultValue: 'server.log' },
    { name: 'verbose', alias: 'v', type: Boolean, defaultValue: false },
    { name: 'useConsole', alias: 'c', type: Boolean, defaultValue: false },
    { name: 'port', alias: 'p', type: Number, defaultValue: 0 }
]);

const handlers: Route[] = [];

/**
 * Queries the database
 */
let query: queryFunc = () => new Promise(() => {
    error`SQL server not connected`;
});

/**
 * Define a route that the server will respond to.
 */
export default function route (path: string, handler: Handler) {
    try {
        handlers.push(new Route(path, handler));
    } catch (e) {
        error`Error adding route: ${e}`;
    }
}

import './routes/users';
import './routes/server';
import './routes/house-points';

async function serverResponse (req: IncomingMessage, res: ServerResponse) {

    // set response headers
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || '*');
    res.setHeader("Access-Control-Allow-Methods", "GET");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader('Content-Type', 'application/json');

    // find route which matches request path
    const routes = handlers.filter((route) => {
        return route.matches(req.method || 'GET', req.url);
    });

    if (routes.length > 1) {
        warning`300: Multiple routes for ${req.method} '${req.url}'`;
        res.writeHead(300);
        res.end(JSON.stringify(routes.map(r => r.asString())));
        return;

    } else if (routes.length === 0) {
        warning`404: ${req.method} '${req.url}'`;
        res.writeHead(404);
        res.end(JSON.stringify({
            status: 404,
            error: `No path matches [${req.method}] '${req.url}'`
        }));
        return;
    }

    const route = routes[0];
    const requestParameters = route.getParams(req.url);

    const finalResponse = await route.handle({
        params: requestParameters,
        res,
        req,
        url: req.url || '',
        query,
        cookies: parseCookies(req.headers.cookie || '')
    });

    const strResponse = JSON.stringify(finalResponse);

    if (flags.verbose) {
        log`${req.method} '${req.url}' => '${strResponse.substring(0, 50)}'`;
    }

    res.writeHead(finalResponse.status);
    res.end(strResponse);
}

function startServer () {

    let options = {};
    if (!flags.dev) {
        options = {
            key: fs.readFileSync("./privatekey.pem"),
            cert: fs.readFileSync("./certificate.pem")
        };
    }

    let PORT = process.env.PORT;

    if (flags.port) {
        PORT = flags.port;
    }

    if (!PORT) {
        error`No port specified in .env or command line`;
        return;
    }

    let server: http.Server | https.Server;

    if (flags.dev) {
        server = http.createServer(options, serverResponse)
            .listen(PORT, () => {
                log(c.green(`Dev server started on port ${PORT}`));
            });
    } else {
        server = https.createServer(options, serverResponse)
            .listen(PORT, () => {
                log(c.green(`Production server started on port ${PORT}`));
            });
    }

    process.on('SIGTERM', () => {
        server.close(async () => {
            log`Server stopped, stopping process...`;
            await stopLogger();
            process.exit(0);
        });
    });
}

function connectToMySQL () {
    log`Connecting to SQL server...`;
    query = connectSQL();
}

(async () => {
    loadEnv();
    setLogOptions(flags);
    connectToMySQL();
    startServer();
})();