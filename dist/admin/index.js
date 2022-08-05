import * as core from "../assets/js/main.js";
import insertComponent from "../assets/js/components.js";

const $addHpReason = document.getElementById('add-hp-reason');
const $pendingHPs = document.getElementById('pending');
const $numPendingHPs = document.getElementById('num-pending');
// gets replaced with input element once loaded
let $addHPName = document.getElementById('add-hp-name-inp');
const $addHPSubmit = document.getElementById('add-hp-submit');

(async () => {
    await core.init('..', true, true);

    $addHPName = insertComponent($addHPName).studentEmailInputWithIntellisense();

    core.hide('#admin-link');

    await main();
})();

async function main () {
    const { data: pending } = await core.api`get/house-points?status=Pending`;

    $numPendingHPs.innerText = pending.length;

    // clear after async request
    $pendingHPs.innerHTML = '';

    let i = 0;
    for (let hp of pending) {
        $pendingHPs.innerHTML += housePointHML(hp);

        if (i === 4) {
            $pendingHPs.innerHTML += `
                <div style="text-align: center; padding: 20px">
                    And ${pending.length-5} more...
                </div>
            `;
            break;
        }
        i++;
    }

    if (i === 0) {
        $pendingHPs.innerHTML = `
            <p style="text-align: center">
                No Pending House Points!
            </p>
        `;
    }

    core.reloadDOM();
}


function housePointHML (hp) {
    const submittedTime = hp['created'] * 1000;

    return `
        <div class="house-point">
            <button 
                onclick="signInAs('${hp['userID']}', '${hp['studentEmail']}')"
                svg="login.svg"
               data-label="Sign in as ${hp['studentEmail']}"
                style="--offset-x: 50%"
                class="icon small"
                aria-label="Sign in as ${hp['studentEmail']}"
            >
                ${hp['studentEmail'].split('@')[0]}
            </button>
            <div style="padding: 0 50px;">
                ${hp['description']}
            </div>
            <div>
                ${new Date(submittedTime).toDateString()}
                (${core.getRelativeTime(submittedTime)})
            </div>
            <div>
                <button 
                    onclick="reject('${hp['id']}', prompt('Rejection Reason'))"
                    class="icon"
                    aria-label="Reject"
                    svg="red-cross.svg"
                   data-label="Reject"
                ></button>
                <button
                    onclick="accept('${hp['id']}')"
                    class="icon"
                    svg="accent-tick.svg"
                    aria-label="Accept"
                   data-label="Accept"
                ></button>
            </div>
        </div>
    `;
}

async function signInAs (id, email) {
    if (!confirm(`Sign in as ${email}?`)) {
        return;
    }

    const { sessionID } = await core.api`create/sessions/from-user-id/${id}`;

    if (!sessionID) return;

    await core.setAltSessionCookie(core.getSession());
    await core.setSessionCookie(sessionID);
    await core.navigate(`/user`);
}

async function accept (id) {
    await core.api`update/house-points/accepted/${id}`;
    await main();
}

async function reject (id, reject) {
    if (!reject) return;
    await core.api`update/house-points/accepted/${id}?reject=${reject}`;
    await main();
}

$addHPSubmit.onclick = async () => {

    if (!$addHpReason.value) {
        await core.showError('Reason required');
        return;
    }

    if (!$addHPName.value) {
        await core.showError('Name required');
        return;
    }

    const codeRes = await core.api`get/users/code-from-name/${$addHPName.value}`;

    if (!codeRes.ok || !codeRes.code) {
        // error automatically shown
        return;
    }

    await core.api`create/house-points/give/${codeRes.code}/1?description=${$addHpReason.value}`;

    $addHpReason.value = '';

    await main();
};
