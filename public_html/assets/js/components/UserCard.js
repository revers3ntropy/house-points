'use strict';
import * as core from '../main.js';

/**
 * @param {El} $el
 * @param {() => User} getEvent getter for event data
 * @param {boolean} admin should be admin options be shown
 */
window.hydrate.Component(
    'user-card',
({ $el, id, getUser, includeTitle=true }) => {
    /** @type User */
    let user;

    let userCard = document.createElement('div');
    userCard.classList.add('user-card');
    $el.appendChild(userCard);

    window[`_UserCard${id}__signInAs`] = async (...args) => {
        await core.signInAs(...args);
    };

    async function render() {
        const admin = await core.isAdmin();
        
        userCard.setAttribute('pour.user', JSON.stringify(user));

        userCard.innerHTML = `
			<h2 hidden="${!includeTitle}">
				${admin ? `
					<button 
						class="icon medium"
						svg="account.svg"
						onclick="_UserCard${id}__signInAs('${user.id}', '${user.email}')"
						data-label="Sign in as"
					></button>
				` : ''}
				<a href="${core.ROOT_PATH}/user/?email=${user.email}">
					${core.escapeHTML(user.email)}
				</a>
			</h2>
			<div>
			    <div
			        foreach="award in user.awards"
			        class="flex-wrap"
			    >
			        <award-type args="award"></award-type>
                </div>
				<h3>
					${core.escapeHTML(user['accepted'])} House Points Awarded
				</h3>
				${admin ? `
					<p>
					    (${core.escapeHTML(user.pending)} pending,
                         ${core.escapeHTML(user.rejected)} rejected)
                    </p>
				` : ``}
				<div class="user-card-housepoints">
					${user['housePoints'].map((point, i) =>
                            core.inlineComponent(
                                HousePoint,
                                point,
                                hardReload,
                                {
                                    admin,
                                    showBorderBottom: i !== user['housePoints'].length - 1,
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
                                    dateEditable: false,
                                }
                            )
                        ).join('')}
					
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
                    await core.showError('Quantity must be 1 or more');
                    return;
                }

                if (!description) {
                    await core.showError('Description is required');
                    return;
                }

                await core.api(`create/house-points/give`, {
                    userId: user.id,
                    quantity,
                    description,
                });
                await hardReload();
            });
        }
    }

    async function hardReload() {
        const newUser = await getUser();
        if (!newUser) {
            await core.showError('User not found');
            return;
        }
        user = newUser;
        await render();
        core.reloadDOM(userCard);
    }

    hardReload().then();
});
