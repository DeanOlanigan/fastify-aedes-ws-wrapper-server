export async function validateSessionUser(request, reply) {
    const sessionUser = request.session.user;
    if (!sessionUser) {
        return { authenticated: false };
    }

    const currentUser = request.server.authStore.users[sessionUser.userId];
    if (!currentUser || currentUser.isDisabled) {
        await request.session.destroy();
        return { authenticated: false };
    }

    const currentVersion = currentUser.authzVersion ?? 1;
    if (currentVersion !== sessionUser.authzVersion) {
        await request.session.destroy();
        return { authenticated: false };
    }

    return { authenticated: true, currentUser };
}