let currentComponentID = 0;

/**
 *  Wrapper for inserting a component into the DOM.
 *  Call function on return value of this function to actually add the element.
 *
 * @param {HTMLElement|string|undefined} [$el=document.body]
 * @returns {{[key: string]: (...args: any[]) => any}}
 */
function insertComponent ($el=document.body) {
    if (typeof $el === 'string') {
        $el = document.querySelector($el);
    }
    return {
        studentEmailInputWithIntellisense: () => {
            const id = currentComponentID++;
            $el.innerHTML += `
                <span>
                    <span class="student-email-input-wrapper">
                        <input
                            type="text"
                            class="student-email-input"
                            placeholder="Email"
                            aria-label="student email"
                            id="student-email-input-${id}"
                        >
                        <div
                            class="student-email-input-dropdown" 
                            id="student-email-input-dropdown-${id}"
                        ></div>
                    </span>
                </span>
            `;

            const $studentNameInput = document.getElementById(`student-email-input-${id}`);
            const $dropdown = document.getElementById(`student-email-input-dropdown-${id}`);

            window[`onClickStudentEmailInput${id}`] = (value) => {
                $studentNameInput.value = value;
            };

            window.addEventListener('click', () => {
                $dropdown.classList.remove('student-email-input-show-dropdown');
            });

            api`get/users/all`.then(({data}) => {

                const studentNames = data.map(student => student['email']);

                $studentNameInput.addEventListener('input', async () => {
                    const value = $studentNameInput.value;

                    if (!value) {
                        $dropdown.classList.remove('student-email-input-show-dropdown');
                        return;
                    }

                    const users = studentNames.filter(name =>
                        name.toLowerCase().includes(value.toLowerCase())
                    );

                    if (users.length === 0) {
                        $dropdown.classList.remove('student-email-input-show-dropdown');
                        return;
                    }

                    $dropdown.classList.add('student-email-input-show-dropdown');

                    $dropdown.innerHTML = '';

                    for (let name of users) {
                        $dropdown.innerHTML += `
                            <div onclick="window['onClickStudentEmailInput${id}']('${name}')">
                                ${name} 
                            </div>
                        `;
                    }
                });
            });

            return $studentNameInput;
        },

        cookiePopUp: () => {

            /**
             * The user has either allowed or not allowed cookies
             * @param {boolean} value
             */
            window.allowedCookies = async value => {
                hide($el);
                if (!value) {
                    return;
                }
                await setCookie(COOKIE_ALLOW_COOKIES_KEY, '1', 365);
            };

            $el.innerHTML += `
                <h2>Cookies</h2>
                <p>
                    We and selected third parties use cookies or similar technologies for
                    technical purposes and, with your consent, for other purposes.
                    Denying consent may make related features unavailable.
                    You can freely give, deny, or withdraw your consent at any time.
                    You can consent to the use of such technologies by using the “Accept” button.
                </p>
        
                <button 
                    onclick="allowedCookies(true)"
                    class="big-link"
                >
                    Accept
                </button>
                <button 
                    onclick="allowedCookies(false)"
                    class="big-link"
                >
                    Reject
                </button>
            `;
        },

        fullPagePopUp: (content) => {
            if (document.getElementById('full-page-popup')) {
                // remove any current popups
                const $p = document.getElementById('full-page-popup');
                $p.parentElement.removeChild($p);
            }

            const $p = document.createElement('div');
            $p.id = 'full-page-popup';

            $p.innerHTML = `
                <div id="full-page-popup-content">
                    ${content}
                </div>
            `;

            // add to page
            $el.appendChild($p);

            function hide () {
                $el.removeChild($p);
            }

            $p.addEventListener('click', (evt => {
                // check that we clicked on the background not the popup content
                if (evt.target.id === 'full-page-popup') {
                    hide();
                }
            }));

            return hide;
        },

        addEventPopUp: () => {

            let studentsInEvent = {};

            let $nameInp;
            let $descInp;
            let $timeInp;
            let $addEventAddStudent;
            let $addEventAddStudentsHTML;

            window.addStudentToEvent = async () =>{
                const email = $addEventAddStudent.value;

                if (!email) {
                    showError('Need an email to add student to event').then();
                    return;
                }

                const user = await api`get/users/from-email/${email}`;

                if (!user.ok) {
                    // error automatically shown
                    return;
                }

                studentsInEvent[user['id']] = 1;

                $addEventAddStudent.value = '';

                await window.showStudentsInAddEvent();
            }

            window.removeStudentFromEvent = async (id) => {
                delete studentsInEvent[id];
                await window.showStudentsInAddEvent();
            }

            window.updateStudentPoints = async (id, points) => {
                // can't go below 1 hp
                studentsInEvent[id] = Math.max(points, 1);
                await window.showStudentsInAddEvent();
            }

            window.showStudentsInAddEvent = async () => {

                if (!Object.keys(studentsInEvent).length) {
                    $addEventAddStudentsHTML.innerHTML = 'No students selected';
                    return;
                }

                const { data } = await api`get/users/batch-info/${Object.keys(studentsInEvent).join(',')}`;

                let html = '';
                for (let user of data) {
                    const { email, id, year } = user;
                    html += `
                        <div class="add-student-to-event-student">
                            <div style="display: block">
                                ${email} 
                                (Y${year})
                                gets
                                <input
                                    type="number"
                                    value="${studentsInEvent[id]}"
                                    onchange="updateStudentPoints('${id}', this.value)"
                                    style="width: 40px"
                                >
                                house points
                            
                            </div>
                            <div style="display: block">
                                <button
                                    onclick="removeStudentFromEvent('${id}')"
                                    label="Remove ${email} from new event"
                                    aria-label="Remove ${email} from new event"
                                    svg="bin.svg"
                                    class="icon"
                                ></button>
                            </div>
                        </div>
                    `;
                }

                $addEventAddStudentsHTML.innerHTML = html;
                reloadDOM();
            }

            const hide = insertComponent($el).fullPagePopUp(`
                <h1>Add Event</h1>
                <div>
                    <label>
                        <input
                            type="text"
                            id="add-event-name"
                            placeholder="Name"
                            aria-label="name"
                        >
                    </label>
                    <label>
                        <input
                            type="datetime-local"
                            id="add-event-time"
                            aria-label="event time"
                        >
                    </label>
                    <label>
                        <textarea
                            id="add-event-description"
                            placeholder="Description"
                            aria-label="description"
                        ></textarea>
                    </label>
                    <div>
                        <h2>Students in Event</h2>
                        <label id="add-event-student-inp"></label>
                        <label>
                            <button
                                onclick="addStudentToEvent()"
                                class="icon"
                                svg="plus.svg"
                                aria-label="add student"
                            ></button>
                        </label>
                        <div id="add-event-students"></div>
                    </div>
                </div>
                <div style="text-align: center; width: 100%; margin: 20px 0;">
                    <button
                            id="add-event-submit"
                            aria-label="add event"
                    >
                        Create Event
                    </button>
                </div>
            `);


            document.getElementById(`add-event-submit`).onclick = async () => {

                if ($nameInp.value.length < 3) {
                    showError('Event name is too short').then();
                    return;
                }

                if (!$timeInp.value) {
                    showError('Event time is required').then();
                    return;
                }

                const time = new Date($timeInp.value).getTime();
                const { id: eventID } = await api`create/events/${$nameInp.value}/${time}?description=${$descInp.value}`;

                $nameInp.value = '';
                $descInp.value = '';

                await Promise.all(Object.keys(studentsInEvent).map(async userID => {
                    await api`create/house-points/give/${userID}/${studentsInEvent[userID]}?event=${eventID}`;
                }));

                studentsInEvent = {};

                hide();
            };

            $nameInp = document.querySelector('#add-event-name');
            $descInp = document.querySelector('#add-event-description');
            $timeInp = document.querySelector('#add-event-time');
            $addEventAddStudentsHTML = document.querySelector('#add-event-students');
            $addEventAddStudent = insertComponent(document.querySelector('#add-event-student-inp'))
                .studentEmailInputWithIntellisense();

            reloadDOM();
        },

        selectableList: ({
            name,
            items,
            uniqueKey,
            searchKey,
            titleBar,
            withAllMenu,
            itemGenerator,
            selected
        }) => {

            window[`${name}selectableList_selectAll`] = (select) => {
                selected.splice(0, selected.length);

                if (select) {
                    for (let item of items) {
                        selected.push(item[uniqueKey]);
                    }
                }
                reload();
            };

            window[`${name}selectableList_select`] = async (id, select) => {
                if (select) {
                    if (selected.indexOf(id) !== -1) {
                        console.error('Cannot reselect ' + id);
                        return;
                    }
                    selected.push(id);
                } else {
                    const index = selected.indexOf(id);
                    if (index !== -1) {
                        selected.splice(index, 1);
                    } else {
                        console.error('Cannot unselect ' + id);
                    }
                }
                reload();
            }

            $el.innerHTML = `
                <div class="selectable-list" id="selectable-list-${name}">
                    <h2>${name}</h2>
                    <div class="with-all-menu">
                        <div>
                            <span class="select-all-outline">
                                <span 
                                    class="icon icon-info-only" 
                                    svg="small-down-arrow.svg"
                                ></span>
                                <button
                                    onclick="${name}selectableList_selectAll(true)"
                                    class="icon"
                                    svg="unselected-checkbox.svg"
                                    label="Select All"
                                    aria-label="select all"
                                ></button>
                
                                <button
                                    onclick="${name}selectableList_selectAll(false)"
                                    class="icon"
                                    svg="unselect-checkbox.svg"
                                    label="Unselect All"
                                    aria-label="unselect all"
                                ></button>
                            </span>
                        </div>
                        <div>
                            ${withAllMenu}
                        </div>
                        <div>
                            <label>
                                <input
                                    placeholder="search for name..."
                                    oninput="${name}selectableList_reloadItems();"
                                    class="search"
                                    autocomplete="off"
                                    aria-label="search"
                                >
                            </label>
                        </div>
                    </div>
                    <div>${titleBar}</div>
                    <div class="items"></div>
                </div>
            `;

            const $items = document.querySelector(`#selectable-list-${name} .items`);
            const $search = document.querySelector(`#selectable-list-${name} .search`);

            function reload (newItems=null) {
                if (newItems) {
                    items = newItems;
                }

                $items.innerHTML = '';

                const searchValue = $search.value.toLowerCase();

                for (let item of items) {
                    if (searchValue && !item[searchKey].toLowerCase().includes(searchValue)) {
                        continue;
                    }

                    const isSelected = selected.includes(item[uniqueKey]);

                    $items.innerHTML += `
                        <div
                            class="item"
                            onclick="${name}selectableList_select('${item[uniqueKey]}', ${!isSelected})"
                        >
                            <button 
                                class="icon no-scale"
                                svg="${isSelected ? 'selected-checkbox' : 'unselected-checkbox'}.svg"
                                aria-label="${isSelected ? 'Unselect' : 'Select'}"
                            ></button>
                            ${itemGenerator(item, isSelected)}
                        </div>
                    `;
                }

                reloadDOM();
            }

            window[`${name}selectableList_reloadItems`] = reload;

            reload();

             return { reload };
        }
    };
}