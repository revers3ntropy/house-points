'use strict';
import { registerComponent } from '../dom.js';
import * as core from '../main.js';

/**
 * @param {El} $el
 * @param {AwardType} awardType
 * @returns {HTMLElement} the HTMLInputElement
 */
export default registerComponent('AwardType', (
    $el, id, award, { fill = 'var(--text)' } = {}
) => {
    if (typeof award !== 'object') {
        console.error(`AwardType: award is not an object:`, award);
        return;
    }
    
    // window[`_Email${id}__onclick`] = async () => {
    //     await core.awardPopup(email);
    // };
    
    const required = award.awardRequirement ?? award.awardHpsRequired ?? award.hpsRequired;
    const name = award.awardTypeName ?? award.awardName ?? award.name;
    
    const timeStamp = award.awarded;
    const awardedInfo = timeStamp ? ` ${core.getRelativeTime(timeStamp * 1000)}` : '';
    
    const label = `(${required})${awardedInfo}`;
    
    $el.innerHTML = `
        <span
            data-label="${core.escapeHTML(label)}"
            style="fill: ${fill} !important"
            class="bordered big-link secondary"
        >
            <span class="icon-info-only icon">${award.icon}</span> ${name}
            <span
                style="position: absolute; transform: translate(150px, -35px) rotate(30deg);"
                svg="award.svg"
                class="icon medium icon-info-only"
            ></span>
        </span>
    `;
});
