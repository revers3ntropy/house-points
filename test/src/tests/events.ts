import Test from '../framework';
import { generateUser } from "../util";


Test.test('Creating, getting and deleting events', async (api) => {

    // check no events at start
    let res = await api(`get/events/all`);
    if (res.ok !== true) {
        return `get/events/all failed: ${JSON.stringify(res)}`;
    }
    if (res?.data?.length !== 0) {
        return `Expected no events ${JSON.stringify(res)}`;
    }

    // use:
    // new Date(document.getElementById(???).value).getTime();
    // to get timestamp from form

    // create event
    const now = Date.now() / 1000;
    res = await api(`create/events/doing+something+2022/${now}`);
    if (res.ok !== true || res.status !== 201) {
        return `create/events/doing+something+2022 failed: ${JSON.stringify(res)}`;
    }
    // get event
    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }

    const [ code ] = await generateUser(api);

    // same but without admin user

    // this should fail, only admins can create events
    res = await api(`create/events/doing+something+else+2022/${now}`, code);
    if (res.ok || res.status !== 401) {
        return `Expected 401 from 'create/events/doing+something+else+2022', got '${JSON.stringify(res)}'`;
    }

    // everyone logged in can see the events though
    res = await api(`get/events/all`, code);
    if (res?.data?.length !== 1) {
        return `Expected 1 events, got ${JSON.stringify(res)}`;
    }
    if (res.data[0].code !== 'doing something 2022') {
        return `Expected event name to be 'doing something 2022', got '${res.data[0].code}'`;
    }

    const [ { id } ] = res.data;

    // deleting shouldn't work without admin user either
    res = await api(`delete/events/with-id/${id}`, code);
    if (res.ok || res.status !== 401) {
        return `Expected 401 from 'delete/events/with-id/${id}', got '${JSON.stringify(res)}'`;
    }

    // check that the event is still there
    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }

    // now delete with admin user
    res = await api(`delete/events/with-id/${id}`);
    if (res.ok !== true || res.status !== 200) {
        return `delete/events/with-id/${id} failed: ${JSON.stringify(res)}`;
    }

    // check that the event is gone
    res = await api(`get/events/all`);
    if (res?.data?.length !== 0) {
        return `Expected no events, got ${JSON.stringify(res)}`;
    }

    await api(`delete/users/${code}`);

    return true;
});

Test.test('Updating event name', async (api) => {
    const now = Date.now() / 1000;

    const [ code ] = await generateUser(api);

    // create event
    let res = await api(`create/events/doing+something+2022/${now}`);
    if (res.ok !== true || res.status !== 201) {
        return `create/events/doing+something+2022 failed: ${JSON.stringify(res)}`;
    }

    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }
    const [ { id, name } ] = res.data;
    if (name !== 'doing something 2022') {
        return `Expected event name to be 'doing something 2022', got '${name}'`;
    }

    // update event name
    res = await api(`update/events/change-name/${id}/doing+something+else+2022`);
    if (res.ok !== true || res.status !== 200) {
        return `update/events/${id}/name/doing+something+else+2022 failed: ${JSON.stringify(res)}`;
    }

    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }
    const [ { id: id2, name: name2 } ] = res.data;
    if (id !== id2) {
        return `Expected event id to be '${id}', got '${id2}'`;
    }
    if (name2 !== 'doing something else 2022') {
        return `Expected event name to be 'doing something else 2022', got '${name2}'`;
    }

    // updating without permission
    res = await api(`update/events/change-name/${id}/not+doing+anything`, code);
    if (res.ok || res.status !== 401) {
        return `Expected 401 from 'update/events/${id}/name/not+doing+anything', got '${JSON.stringify(res)}'`;
    }

    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }
    const [ { id: id3, name: name3 } ] = res.data;
    if (id !== id3) {
        return `Expected event id to be '${id}', got '${id3}'`;
    }
    if (name3 !== 'doing something else 2022') {
        return `Expected event name to be 'doing something else 2022', got '${name3}'`;
    }

    await api(`delete/users/${code}`);
    await api(`delete/events/with-id/${id}`);

    return true;
});


Test.test('Updating event timestamp', async (api) => {
    const now = Date.now() / 1000;
    // 1 week ago
    const then = now - 60 * 60 * 24 * 7;

    const [ code ] = await generateUser(api);

    // create event
    let res = await api(`create/events/doing+something+2022/${now}`);
    if (res.ok !== true || res.status !== 201) {
        return `create/events/doing+something+2022 failed: ${JSON.stringify(res)}`;
    }

    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }
    const [ { id, name, time } ] = res.data;
    if (name !== 'doing something 2022') {
        return `Expected event name to be 'doing something 2022', got '${name}'`;
    }
    if (time !== now) {
        return `Expected event time to be '${now}', got '${time}'`;
    }

    // update event name
    res = await api(`update/events/change-time/${id}/${then}`);
    if (res.ok !== true || res.status !== 200) {
        return `update/events/change-time/id/then failed: ${JSON.stringify(res)}`;
    }

    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }
    const [ { time: time2 } ] = res.data;
    if (time2 !== then) {
        return `Expected event time to be '${then}', got '${time2}'`;
    }

    // updating without permission
    res = await api(`update/events/change-time/${id}/${now}`, code);
    if (res.ok || res.status !== 401) {
        return `Expected 401 from 'update/events/change-time/id/now', got '${JSON.stringify(res)}'`;
    }

    res = await api(`get/events/all`);
    if (res?.data?.length !== 1) {
        return `Expected 1 event, got ${JSON.stringify(res)}`;
    }
    const [ { time: time3 } ] = res.data;
    if (time3 !== then) {
        return `Expected event time to be '${then}', got '${time3}'`;
    }

    await api(`delete/users/${code}`);
    await api(`delete/events/with-id/${id}`);

    return true;
});