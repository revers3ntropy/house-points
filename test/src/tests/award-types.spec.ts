import Test from '../framework';
import { generateUser } from '../util';

Test.test('Award Types | Creating, getting and deleting', async api => {
    let res = await api(`get/award-types`);
    if (res.ok !== true) {
        return `0: ${JSON.stringify(res)}`;
    }
    if (res?.data?.length !== 0) {
        return `1: ${JSON.stringify(res)}`;
    }

    res = await api(`create/award-types`, {
        name: 'House Tie',
        required: 18
    });
    if (res.ok !== true || res.status !== 201 || !res.id) {
        return `2: ${JSON.stringify(res)}`;
    }
    res = await api(`get/award-types`);
    if (res?.data?.length !== 1) {
        return `3: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.name !== 'House Tie') {
        return `4: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.description !== '') {
        return `5: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.hpsRequired !== 18) {
        return `6: ${JSON.stringify(res)}`;
    }
    const id = res.data?.[0]?.id;
    if (!id) {
        return `7: ${JSON.stringify(res)}`;
    }
    res = await api(`delete/award-types`, {
        awardTypeId: res.data?.[0]?.id
    });
    if (res.ok !== true || res.status !== 200) {
        return `8: ${JSON.stringify(res)}`;
    }

    res = await api(`get/award-types`);
    if (res?.data?.length !== 0) {
        return `9: ${JSON.stringify(res)}`;
    }

    return true;
});

Test.test('Award Types | Creating, getting and deleting auth', async api => {
    const { sessionId, userId } = await generateUser(api);

    let res = await api(`get/award-types`, {
        session: sessionId
    });
    if (res?.ok !== true || res?.data?.length !== 0) {
        return `0: ${JSON.stringify(res)}`;
    }

    res = await api(`create/award-types`, {
        name: 'House Tie',
        required: 18,
        session: sessionId
    });
    if (res?.ok || res?.status !== 401) {
        return `2: ${JSON.stringify(res)}`;
    }

    // assumed to work
    await api(`create/award-types`, {
        name: 'House Tie',
        required: 18
    });

    res = await api(`get/award-types`, {
        session: sessionId
    });
    if (res.ok !== true) {
        return `3: ${JSON.stringify(res)}`;
    }
    if (res?.data?.length !== 1) {
        return `4: ${JSON.stringify(res)}`;
    }

    res = await api(`delete/award-types`, {
        session: sessionId,
        id: res.data?.[0]?.id
    });
    if (res.ok || res.status !== 401) {
        return `5: ${JSON.stringify(res)}`;
    }

    await api(`delete/award-types`, {
        awardTypeId: res.data?.[0]?.id
    });

    await api(`delete/users`, { userId });

    return true;
});

Test.test('Award  Types | Updating name', async api => {
    const { sessionId, userId } = await generateUser(api);

    await api(`create/award-types`, {
        name: 'House Points',
        quantity: 18
    });

    let res = await api(`get/award-types`);
    if (res.ok !== true) {
        return `0: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.name !== 'House Tie') {
        return `1: ${JSON.stringify(res)}`;
    }

    res = await api(`update/award-types/name`, {
        name: 'House Tie 2',
        awardTypeId: res.data?.[0]?.id
    });
    if (res.ok !== true || res.status !== 200) {
        return `2: ${JSON.stringify(res)}`;
    }
    res = await api(`get/award-types`);
    if (res.ok !== true) {
        return `3: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.name !== 'House Tie 2') {
        return `4: ${JSON.stringify(res)}`;
    }

    res = await api(`update/award-types/name`, {
        session: sessionId,
        name: 'House Tie',
        awardTypeId: res.data?.[0]?.id
    });
    if (res.ok || res.status !== 401) {
        return `5: ${JSON.stringify(res)}`;
    }
    res = await api(`get/award-types`, {
        session: sessionId
    });
    if (res.ok !== true) {
        return `6: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.name !== 'House Tie 2') {
        return `7: ${JSON.stringify(res)}`;
    }

    await api(`delete/award-types`, {
        awardTypeId: res.data?.[0]?.id
    });

    await api(`delete/users`, { userId });

    return true;
});

Test.test('Award  Types | Updating quantity', async api => {
    const { sessionId, userId } = await generateUser(api);

    await api(`create/award-types`, {
        name: 'House Tie',
        required: 18
    });

    let res = await api(`get/award-types`);
    if (res.ok !== true) {
        return `0: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.hpsRequired !== 18) {
        return `1: ${JSON.stringify(res)}`;
    }

    res = await api(`update/award-types/hps-required`, {
        awardTypeId: res.data?.[0]?.id,
        quantity: 20
    });
    if (res.ok !== true || res.status !== 200) {
        return `2: ${JSON.stringify(res)}`;
    }
    res = await api(`get/award-types`);
    if (res.ok !== true) {
        return `3: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.hpsRequired !== 20) {
        return `4: ${JSON.stringify(res)}`;
    }

    res = await api(`update/award-types/hps-required`, {
        session: sessionId,
        awardTypeId: res.data?.[0]?.id,
        quantity: 18
    });
    if (res.ok || res.status !== 401) {
        return `5: ${JSON.stringify(res)}`;
    }
    res = await api(`get/award-types`, {
        session: sessionId
    });
    if (res.ok !== true) {
        return `6: ${JSON.stringify(res)}`;
    }
    if (res.data?.[0]?.hpsRequired !== 20) {
        return `7: ${JSON.stringify(res)}`;
    }

    await api(`delete/award-types`, {
        id: res.data?.[0]?.id
    });

    await api(`delete/users`, { userId });

    return true;
});
