// Utility script imported by all pages


// Global constants and variables
const API_PORT = 4464,
      API_ROOT = location.origin + ':' + API_PORT,
      COOKIE_KEY = 'hpCode',
      ALT_COOKIE_KEY = 'hpAltCode',
      HOUSE_NAME = 'Osmond',
      ALPHABET_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      ALPHABET_NUMBERS = '0123456789',
      ALPHABET_LOWER = 'abcdefghijklmnopqrstuvwxyz';

let ROOT_PATH = '',
    $nav, $footer, $error,
    currentErrorMessageID = 0,
    currentlyShowingErrorMessageIDs = [],
    currentlyShowingLoadingAnim = false,
    userInfoCallbacks = [],
    userInfoJSON = null,
    altUserInfoJSON = null,
    isSignedIn = false,
    userInfoIsLoaded = false,
    onLoadCBs = [],
    documentLoaded = false;

const timeUnits = {
    year  : 24 * 60 * 60 * 1000 * 365,
    month : 24 * 60 * 60 * 1000 * 365/12,
    day   : 24 * 60 * 60 * 1000,
    hour  : 60 * 60 * 1000,
    minute: 60 * 1000,
    second: 1000
};

const relativeTimeFormat = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto'
});

async function sleep (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// user auth code utilities
function getCode () {
    return getCookie(COOKIE_KEY);
}

function setCodeCookie (code) {
    setCookie(COOKIE_KEY, code);
}

function getAltCode () {
    return getCookie(ALT_COOKIE_KEY);
}

function setAltCodeCookie (code) {
    setCookie(ALT_COOKIE_KEY, code);
}



/**
 * @returns {Promise<unknown>}
 */
async function userInfo () {
    if (userInfoIsLoaded) {
        return userInfoJSON;
    }
    return new Promise(resolve => {
        userInfoCallbacks.push(resolve);
    });
}

/**
 * @returns {Promise<unknown>}
 */
async function signedIn () {
    if (userInfoIsLoaded) {
        return isSignedIn;
    }
    return new Promise(resolve => {
        userInfoCallbacks.push(() => {
            resolve(isSignedIn);
        });
    });
}

/**
 * @param {number} d1
 * @param {number} [d2=new Date()]
 * @returns {string}
 */
function getRelativeTime (d1, d2) {
    d2 ||= Date.now();
    const elapsed = d1 - d2;

    // "Math.abs" accounts for both "past" & "future" scenarios
    for (const u in timeUnits) {
        if (Math.abs(elapsed) > timeUnits[u] || u === 'second') {
            return relativeTimeFormat.format(Math.round(elapsed/timeUnits[u]), u);
        }
    }
}

/**
 * Loads a JS script from an url.
 * If the url starts with '/', imports relative to ROOT_PATH.
 * Resolves the promise once the script has been loaded.
 * @param {string} url
 * @returns {Promise<unknown>}
 */
async function loadScript (url) {
    const script = document.createElement('script');
    script.type = 'text/javascript';

    if (url[0] === '/') {
        url = ROOT_PATH + url;
    }
    script.src = url;

    return await new Promise(resolve => {
        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        script.onreadystatechange = resolve;
        script.onload = resolve;

        // Fire the loading
        document.head.appendChild(script);
    });
}

// Cookie Utilities

// src: https://stackoverflow.com/questions/14573223/set-cookie-and-get-cookie-with-javascript
/**
 * @param {string} name
 * @param {string} value
 * @param {number} days
 */
function setCookie (name, value='', days=1) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24*60*60*1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
}

/**
 * @param {string} name
 * @returns {string|null}
 */
function getCookie (name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' '){
            c = c.substring(1, c.length);
        }
        if (c.indexOf(nameEQ) === 0) {
            return c.substring(nameEQ.length, c.length);
        }
    }
    return null;
}

/**
 * @param {string} name
 */
function eraseCookie (name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

/**
 * Gets a GET parameter from the URL of the page
 * @param name
 */
function GETParam (name) {
    let result = null,
        tmp = [];

    location.search
        .substring(1)
        .split("&")
        .forEach(function (item) {
            tmp = item.split("=");
            if (tmp[0] === name) {
                result = decodeURIComponent(tmp[1]);
            }
        });

    return result;
}

/**
 * @param {string} text
 * @returns {Promise<void>}
 */
async function copyToClipboard (text) {
    await navigator.clipboard.writeText(text);
}

/**
 * Cleans a user code
 * @param {string} code
 * @returns {string}
 */
function cleanCode (code) {
    return code
        .split('')
        // remove non-alphabetic characters
        .filter(c => 'abcdefghijklmnopqrstuvwxyz'.indexOf(c.toLowerCase()) !== -1)
        .join('')
        // default to upper case
        .toUpperCase()
        // max length
        .substring(0, 10);
}

/**
 * @param {HTMLElement} self
 * @returns {Promise<void>}
 */
async function loadSVG (self) {
    if (self.hasAttribute('svg-loaded')) {
        return;
    }
    // set before loading, so we don't load twice while waiting for the svg to load
    self.setAttribute('svg-loaded', '1');

    const uri = ROOT_PATH + '/assets/img/' + self.attributes['svg'].value;
    const raw = await fetch(uri);
    if (!raw.ok) {
        console.error(`Failed to load SVG at '${uri}' for `, self);
        return;
    }
    self.innerHTML = await raw.text() + self.innerHTML;
}

/**
 * @param {HTMLElement} self
 */
function loadLabel (self) {
    if (self.hasAttribute('label-loaded')) {
        return;
    }
    self.setAttribute('label-loaded', '1');

    self.innerHTML = `
        <span class="label">
            ${self.attributes['label'].value}
        </span> 
        ${self.innerHTML}
    `;
}

// Spinner

function showSpinner () {
    document.body.style.cursor = 'progress';
    const loader = document.createElement('div');
    document.body.appendChild(loader);
    loader.classList.add('lds-ripple');
    loader.innerHTML = `<div></div><div></div>`;
    return loader;
}

function stopSpinner (loader) {
    currentlyShowingLoadingAnim = false;
    document.body.removeChild(loader);
    document.body.style.cursor = 'default';
}


/**
 * Connect to the API without all the checks and spinners and stuff
 * @param path
 * @returns {Promise<{}>}
 */
async function rawAPI (path) {
    if (path[0] === '/') {
        path = path.substring(1);
    }

    // fetch
    const res = await fetch(`${API_ROOT}/${path}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        credentials: 'include'
    });

    let asJSON;
    try {
        asJSON = await res.json();
    } catch (e) {
        asJSON = {
            error: 'Failed to parse response as JSON'
        };
    }

    return asJSON;
}

/**
 * Show loading while requests are being made
 * but only show the spinner if no other requests are still pending,
 * which would mean the spinner is already being shown.

 * @param {string | TemplateStringsArray} path
 * @param args
 * @returns {Promise<Record<string, any>>}
 */
async function api (path, ...args) {

    if (typeof path !== 'string') {
        path = path.reduce((acc, cur, i) => {
            if (typeof args[i] === 'object') {
                args[i] = JSON.stringify(args[i]);
            }
            let paramStr = (args[i] || '').toString();
            return acc + cur + paramStr;
        }, '');
    }

    let shouldHideAtEnd = false;
    let loader;
    if (!currentlyShowingLoadingAnim) {
        // pre-fetch
        currentlyShowingLoadingAnim = true;
        shouldHideAtEnd = true;

        loader = showSpinner();
    }

    if (path[0] === '/') {
        path = path.substring(1);
    }

    // fetch
    const res = await fetch(`${API_ROOT}/${path}`, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
        redirect: 'follow',
        credentials: 'include'
    }).catch(err => {
        console.error('Error with API request: ', err);
        if (shouldHideAtEnd) {
            stopSpinner(loader);
        }
        showError('Something went wrong!');
    });

    if (res.status === 404) {
        showError('Something went wrong! (404 in API)');
        if (shouldHideAtEnd) {
            stopSpinner(loader);
        }
        return {};
    }

    let asJSON = {};
    try {
        // this might fail if the response is not JSON
        asJSON = await res.json();

        // don't try to show error in response if there is no response, so also in try block
        if (asJSON.error) {
            showError(asJSON.error);
        }

    } catch (err) {
        console.error('Error with API request: ', err);
        showError('Something went wrong!');
    }

    if (shouldHideAtEnd) {
        stopSpinner(loader);
    }

    return asJSON;
}

/**
 * Only to be called by async loaded css onload
 */
function asyncCSS (self) {
    self.onload = null;
    self.rel = 'stylesheet';
}

function loadSVGs () {
    const allInBody = document.querySelectorAll('*');
    for (const element of allInBody) {
        if (element.attributes['svg']) {
            // don't await, because we don't want to block the page load
            loadSVG(element).then();
        }

        if (element.attributes['label']) {
            loadLabel(element);
        }
    }
}

async function loadNav () {
    $nav.innerHTML = await (await fetch(`${ROOT_PATH}/assets/html/nav.html`)).text();

    if (getAltCode()) {
        rawAPI(`get/users/info/${getAltCode()}`)
            .then(info => {
                if (!info['ok']) return;
                if (!info['admin']) return;
                altUserInfoJSON = info;

                const $adminLink = document.getElementById('admin-link');
                $adminLink.style.display = 'block';
                $adminLink.setAttribute('aria-hidden', 'false');
                $adminLink.onclick = () => {
                    setCodeCookie(getAltCode());
                    navigate(`${ROOT_PATH}/admin`);
                };
            });
    }

    // replace links in nav relative to this page
    document.querySelectorAll('nav a').forEach(a => {
        a.setAttribute('href',
            `${ROOT_PATH}${a.getAttribute('href')}`);
    });

    // TODO: show sign out button

    // show page title
    document.querySelector('#nav-center').innerHTML = `
        <div>
            ${HOUSE_NAME} House Points - ${document.title}
        </div>
    `;

    // make home link point to right place
    const { level } = await api`get/users/auth/${getCode()}`
    document.querySelector('#home-link').setAttribute('url',
        `${ROOT_PATH}/${level ? 'admin' : 'student-dashboard'}`);
}

/**
 * Must be called first
 * @param {string} path
 */
async function rootPath (path) {
    ROOT_PATH = path;

    // load footer and nav bar
    $nav = document.querySelector(`nav`);
    $footer = document.querySelector(`footer`);

    $footer.innerHTML = await (await fetch(`${ROOT_PATH}/assets/html/footer.html`)).text();
    if ($nav) {
        await loadNav();
    }

    reloadDOM();
}

function reloadDOM () {
    loadSVGs();
}

function scrollToTop () {
    document.body.scrollTop = document.documentElement.scrollTop = 0;
}

/**
 * Navigates to a webpage
 * @param {string} url
 * @returns {Promise<never>}
 */
const navigate = async (url) => {
    window.location.assign(url);
    // never resolve promise as just wait for the page to load
    await new Promise(() => {});
}

/**
 * @param {string} message - parsed as HTML
 */
function showError (message) {
    if (!$error) {
        $error = document.createElement('div');
        $error.id = 'error-container';
        document.body.appendChild($error);
    }

    let myErrId = currentErrorMessageID++;

    while (currentlyShowingErrorMessageIDs.length > 4) {
        let id = currentlyShowingErrorMessageIDs.shift();
        document.getElementById(`error-${id}`).remove();
    }

    let errorMessage = document.createElement('div');
    errorMessage.innerHTML = `
        ${message}
        <span onclick="this.parentElement.remove()">&times;</span>
    `;
    errorMessage.classList.add('error');
    errorMessage.id = `error-${myErrId}`;
    $error.appendChild(errorMessage);
    currentlyShowingErrorMessageIDs.push(myErrId);

    setTimeout(() => {
        errorMessage.remove();
        currentlyShowingErrorMessageIDs = currentlyShowingErrorMessageIDs.filter(id => id !== myErrId);
    }, 5000);
}


/**
 * Shows an error from a code (a string)
 * @param {string} code
 */
function showErrorFromCode (code) {
    showError({

        'auth': 'You are not authorized for this action',

    }[code] || 'An Unknown Error has Occurred');
}

async function logout () {
    if (!confirm(`Are you sure you want to sign out?`)) {
        return;
    }

    eraseCookie(COOKIE_KEY);
    await navigate(ROOT_PATH);
}

async function waitForReady () {
    await new Promise(resolve => {
        if (documentLoaded) {
            resolve();
            return;
        }
        onLoadCBs.push(resolve);
    });
}

function documentIsLoaded () {
    reloadDOM();
    scrollToTop();

    for (const cb of onLoadCBs) {
        cb();
    }
}

(async () => {
    if (getCode()) {
        rawAPI(`get/users/info/${getCode()}`)
            .then(info => {
                isSignedIn = info.ok;

                if (!info.ok) {
                    info = null;
                }
                userInfoJSON = info;
                userInfoIsLoaded = true;

                for (const cb of userInfoCallbacks) {
                    cb(info);
                }
            });
    }

    await loadScript('/assets/js/components.js');

    if (document.readyState === 'complete') {
        documentIsLoaded();
    } else {
        window.onload = documentIsLoaded;
    }
})();
