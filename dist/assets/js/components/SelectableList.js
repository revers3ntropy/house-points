'use strict';
import { registerComponent } from "./components.js";
import * as core from "../main.js";

/**
 * A list of elements with select icons next to them.
 *
 * @template T
 * @param {El} $root
 * @param {{
 *     name: string,
 *     items: T[],
 *     uniqueKey?: string,
 *     searchKey: string,
 *     titleBar?: string,
 *	   withAllMenu?: string,
 *	   itemGenerator?: (T) => string,
 *	   selected: T[],
 *	   filter?: (T) => boolean,
 * }} options

 * @returns {{ reload: () => void }}
 */
const SelectableList = registerComponent(($el, id, {
	name,
	items,
	uniqueKey='id',
	searchKey,
	titleBar='',
	withAllMenu='',
	itemGenerator,
	gridTemplateColsCSS = '1fr 1fr',
	selected,
	filter = () => true,
}) => {

	core.preloadSVGs('selected-checkbox.svg', 'unselected-checkbox.svg');

	window[`_SelectableList${id}__selectAll`] = async (select) => {
		selected.splice(0, selected.length);

		if (select) {
			for (let item of items) {
				selected.push(item[uniqueKey]);
			}
		}
		await reload();
	};

	window[`_SelectableList${id}__select`] = async (id, select) => {
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
		await reload();
	}

	$el.innerHTML = `
		<div class="selectable-list" id="selectable-list-${id}">
			<h2>${name}</h2>
			<div class="with-all-menu">
				<div>
					<span class="select-all-outline">
						<span 
							class="icon icon-info-only" 
							svg="small-down-arrow.svg"
						></span>
						<button
							onclick="_SelectableList${id}__selectAll(true)"
							class="icon"
							svg="unselected-checkbox.svg"
						   data-label="Select All"
							aria-label="select all"
						></button>
						
						<button
							onclick="_SelectableList${id}__selectAll(false)"
							class="icon"
							svg="unselect-checkbox.svg"
						   data-label="Unselect All"
							aria-label="unselect all"
						></button>
					</span>
					
					${withAllMenu}
				</div>
				<div>
					<label>
						<input
							placeholder="search for ${searchKey}..."
							oninput="_SelectableList${id}__reloadItems()"
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

	const $items = document.querySelector(`#selectable-list-${id} .items`);
	const $search = document.querySelector(`#selectable-list-${id} .search`);

	async function reload (newItems = null) {
		if (newItems) {
			items = newItems;
		}

		$items.innerHTML = '';

		const searchValue = $search.value.toLowerCase();

		for (let item of items) {
			if (searchValue && !item[searchKey].toLowerCase().includes(searchValue)) {
				continue;
			}
			if (!filter(item)) {
				continue;
			}

			const itemID = item[uniqueKey];

			const isSelected = selected.includes(itemID);

			$items.innerHTML += `
				<div class="item">
					<button
						class="icon medium no-scale"
						svg="${isSelected ? 'selected-checkbox' : 'unselected-checkbox'}.svg"
						aria-label="${isSelected ? 'Unselect' : 'Select'}"
						onclick="_SelectableList${id}__select('${itemID}', ${isSelected ? 'false' : 'true'})"
					></button>
					<div class="item-content" style="grid-template-columns: ${gridTemplateColsCSS}">
						  ${await itemGenerator(item, isSelected)}
					</div>
				</div>
			`;
		}

		core.reloadDOM();
	}

	window[`_SelectableList${id}__reloadItems`] = reload;

	reload().then();

	return { reload };
});

export default SelectableList