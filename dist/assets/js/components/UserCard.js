'use strict';
import { registerComponent } from "./components.js";
import * as core from "../main.js";
import { inlineComponent, showError } from "../main.js";
import HousePoint from "./HousePoint.js";

/** @typedef {{
 * 		id?: string,
 * 		email: string,
 * 		year: number,
 * 		accepted: number,
 * 		rejected: number,
 * 		pending: number,
 * 		housePoints: HP[],
 * }} User */

/**
 *
 * @param {El} $el
 * @param {() => User} getEvent getter for event data
 * @param {boolean} admin should be admin options be shown
 */
const UserCard = registerComponent(($el, id, getUser, admin) => {

	/** @type User */
	let user;

	let userCard = document.createElement('div');
	userCard.classList.add('user-card');
	$el.appendChild(userCard);

	window[`_UserCard${id}__signInAs`] = async (...args) => {
		await core.signInAs(...args);
	}

	function render () {
		userCard.innerHTML = `
			<h2>
				${admin ? `
					<button 
						class="icon medium"
						svg="account.svg"
						onclick="_UserCard${id}__signInAs('${user.id}', '${user.email}')"
						data-label="Sign in as"
					></button>
				` : ''}
				<a href="${core.ROOT_PATH}/user/?email=${user.email}">
					${user.email}
				</a>
			</h2>
			<div>
				<h3>
					${user['accepted']} House Points Awarded
				</h3>
				<p>(${user.pending} pending, ${user.rejected} rejected)</p>
				<div class="user-card-housepoints">
					${user['housePoints']
						.map((point, i) => inlineComponent(HousePoint, point, async () => {
							user = await getUser();
							await render();
						}, {
							admin,
							showBorderBottom: i !== (user['housePoints'].length - 1),
							showEmail: false,
							showReason: true,
							showNumPoints: true,
							showDate: true,
							showRelativeTime: true,
							showStatusHint: true,
							showStatusIcon: true,
							showDeleteButton: true,
							showPendingOptions: true,
							reasonEditable: true,
							pointsEditable: true,
							dateEditable: false
						}))
						.join('')}
					
					${admin ? `
						<div class="add-hp">
							<input
								placeholder="New house point description"
								class="new-hp-description"
								aria-label="new house point description"
							>
							<input 
								type="number"
								placeholder="Quantity"
								style="width: 100px"
								class="new-hp-quantity"
								aria-label="new house point quantity"
							>
							<button
							    data-label="Create house point"
								svg="plus.svg"
								class="icon small new-hp-create"
							></button>
						</div>
					` : ''}
				</div>
			</div>
		`;

		if (admin) {
			const $newHpQuantity = userCard.querySelector('.new-hp-quantity');
			const $newHpDescription = userCard.querySelector('.new-hp-description');
			const $newHpCreate = userCard.querySelector('.new-hp-create');

			$newHpCreate.addEventListener('click', async () => {
				const quantity = parseInt($newHpQuantity.value);
				const description = $newHpDescription.value;

				if (quantity < 1) {
					await showError('Quantity must be 1 or more');
					return;
				}

				if (!description) {
					await showError('Description is required');
					return;
				}

				await core.api(`create/house-points/give`, {
					userID: user.id,
					quantity,
					description
				});
				await hardReload();
			});
		}
	}

	async function hardReload () {
		const newUser = await getUser();
		if (!newUser) {
			await core.showError('Event not found');
			return;
		}
		user = newUser;
		render();
		core.reloadDOM();
	}

	hardReload().then();
});

export default UserCard;