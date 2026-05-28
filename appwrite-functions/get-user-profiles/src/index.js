module.exports = async ({ req, res }) => {
    return res.json(
        {
            ok: false,
            status: 501,
            error: 'get-user-profiles is not implemented yet.'
        },
        501
    );
};
