import { ROOT_PATH, svgCache } from "./main.js";

/**
 * Looks at all DOM elements with an 'svg' attribute and loads the SVG
 * file into that element.
 */
export function loadSVGs () {
	const allInBody = document.querySelectorAll('[svg]');
	for (const element of allInBody) {
		// don't await, because we don't want to block the page load
		loadSVG(element)
			.then();
	}
}

/**
 * Caches the SVG file content
 * @param {string} uris
 */
export function preloadSVGs (...uris) {
	for (const uri of uris) {
		if (svgCache[uri]) {
			continue;
		}
		// don't await, because we want to load them all at the same time
		getSVGFromURI(ROOT_PATH + '/assets/img/' + uri)
			.then();
	}
}

/**
 * Loads the SVG file content into the element
 * Adds the SVG HTML before the rest of the contents
 * of the element.
 * @param {HTMLElement} $el
 * @returns {Promise<void>}
 */
export async function loadSVG ($el) {
	// if the SVG has already been loaded then skip
	if ($el.hasAttribute('svg-loaded')) {
		return;
	}
	// set before loading, so we don't load twice while waiting for the svg to load
	$el.setAttribute('svg-loaded', '1');

	const uri = ROOT_PATH + '/assets/img/' + $el.attributes['svg'].value;

	$el.innerHTML = await getSVGFromURI(uri) + $el.innerHTML;
}

/**
 * Gets the SVG file content as plain text by fetching it
 * @param {string} uri
 * @returns {Promise<string|void>}
 */
export async function getSVGFromURI (uri) {
	if (svgCache[uri]) {
		return svgCache[uri];
	}

	// if not cached, then go get it
	const raw = await fetch(uri);
	if (!raw.ok) {
		console.error(`Failed to load SVG at '${uri}' for `, self);
		return;
	}
	let svg = await raw.text();

	svgCache[uri] = svg;
	return svg;
}