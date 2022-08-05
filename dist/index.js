'use strict';
import * as core from "./assets/js/main.js";
import insertComponent from "./assets/js/components.js";

const $go = document.getElementById('go');
const $email = document.getElementById('email');
const $password = document.getElementById('password');

(async () => {
	await core.init('.');

	if (core.GETParam('error')) {
		await core.showErrorFromCode(core.GETParam('error'));
		await core.sleep(1000);
	}

	if (await core.signedIn()) {
		if ((await core.userInfo())['admin']) {
			await core.navigate(`/admin`);
		} else {
			await core.navigate(`/user`);
		}
	}
})();

$go.onclick = async () => {
	const email = $email.value;

	if (!email) {
		core.showError`You need to enter a valid email first!`;
		return;
	}

	const password = $password.value;

	if (!password) {
		core.showError`You need to enter a password first!`;
		return;
	}

	const res = await core.api`create/sessions/from-login/${email}/${password}`;

	if (res.error) {
		return;
	}

	const { sessionID } = res;

	if (!sessionID) {
		core.showError`Something went wrong!`;
		return;
	}

	await core.setSessionCookie(sessionID);
	await core.navigate(`./user`);
};

document.getElementById('forgotten-password').onclick = async () => {
	const email = $email.value;
	if (email.length < 4) {
		core.showError`You need to enter a valid email first!`;
		return;
	}

	if (!confirm(`Are you sure you want to reset the password for '${email}'?`)) {
		return;
	}

	const res = await core.api`create/sessions/for-forgotten-password/${email}`;

	if (!res.ok || res.error) {
		return;
	}

	insertComponent().fullPagePopUp(`
		An email has been sent to '${email}' with a link to reset your password.
	`);

};