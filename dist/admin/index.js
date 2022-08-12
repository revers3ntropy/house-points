import * as core from "../assets/js/main.js";
import StudentEmailInputWithIntellisense from "../assets/js/components/StudentEmailInputWithIntellisense.js";
import HousePoint from "../assets/js/components/HousePoint.js";

const $addHpReason = document.getElementById('add-hp-reason');
const $pendingHPs = document.getElementById('pending');
const $numPendingHPs = document.getElementById('num-pending');
// gets replaced with input element once loaded
let $addHPName = document.getElementById('add-hp-name-inp');
const $addHPSubmit = document.getElementById('add-hp-submit');
window.userPopupFromID = core.userPopupFromID;

(async () => {
    await core.init('..', true, true);

    $addHPName = StudentEmailInputWithIntellisense($addHPName);

    await main();
})();

async function main () {
    const { data: pending } = await core.api`get/house-points?status=Pending`;
    const admin = await core.isAdmin();

    $numPendingHPs.innerText = pending.length;

    // clear after async request
    $pendingHPs.innerHTML = '';

    let i = 0;
    for (let hp of pending) {
        $pendingHPs.innerHTML += core.inlineComponent(HousePoint,
            hp, admin, true, main, i === pending.length-1, true);

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
