import * as core from "./main.js";
import FullPagePopup from "./components/FullPagePopup.js";
import { inlineComponent } from "./main.js";
import EventCard from "./components/EventCard.js";
import UserCard from "./components/UserCard.js";

/**
 * Shows a popup with the event detail from the given event id.
 * @param {string} id
 * @param {boolean | null} [admin=null]
 * @returns {Promise<void>}
 */
export async function eventPopup (id, admin=null) {
	admin = admin === null ? (await core.userInfo())['admin'] : admin;
	FullPagePopup(document.body, inlineComponent(EventCard,
	async () => {
			const events = await core.api(`get/events`, {
				eventID: id
			});
			return events?.['data']?.[0];
		},
		admin
	));
}

/**
 * Shows a popup with the user detail from the given event id.
 * @param {string} id
 * @param {boolean | null} [admin=null]
 * @returns {Promise<void>}
 */
export async function userPopupFromID (id, admin=null) {
	admin = admin === null ? (await core.userInfo())['admin'] : admin;
	FullPagePopup(document.body, inlineComponent(UserCard,
		async () => (await core.api(`get/users`, { userID: id })),
		admin,
	));
}

/**
 * Shows a popup with the event detail from the given event id.
 * @param {string} email
 * @param {boolean | null} [admin=null]
 * @returns {Promise<void>}
 */
export async function userPopup (email, admin=null) {
	admin = admin === null ? (await core.userInfo())['admin'] : admin;
	FullPagePopup(document.body, inlineComponent(UserCard,
		async () => (await core.api(`get/users`, { email })),
		admin,
	));
}