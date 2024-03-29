'use strict';
import * as core from '../main.js';

/**
 * Component for student email input with dropdown for autocompletion of emails in the DB.
 *
 * @param {El} $el
 * @param {string} [placeholder='Email'] placeholder text for the input field
 * @param {boolean} [allowNonStudents=false] filters on 'student' property of  users
 * @param {(value: string) => void} [onDropDownClick=()=>{}] callback for when a dropdown item is clicked
 * @returns {HTMLElement} the HTMLInputElement
 */
window.hydrate.Component('student-email-input-with-intellisense', ({
    $el,
    id,
    placeholder = 'Email',
    allowNonStudents = false,
    onDropDownClick = () => {}
}) => {
    let data;

    return InputWithDropdown(
        $el,
        placeholder,
        async () => {
            data = (await core.api(`get/users`)).data;
            return data.map(user => user.email);
        },
        (item, search) => {
            if (!item.toLowerCase().includes(search.toLowerCase())) {
                return false;
            }
            if (allowNonStudents) {
                return true;
            }
            return data.find(u => u.email === item)?.student === 1;
        },
        10,
        onDropDownClick
    );
});
