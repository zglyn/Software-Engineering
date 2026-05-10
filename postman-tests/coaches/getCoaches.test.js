pm.test("Valid status (200 or 400 or 404)", () => {
    pm.expect([200, 400, 404]).to.include(pm.response.code);
});

if (pm.response.code === 200) {
    pm.test("Response is an object", () => {
        pm.expect(pm.response.json()).to.be.an("object");
    });
}

if (pm.response.code === 400 || pm.response.code === 404) {
    pm.test("Error message exists", () => {
        pm.expect(pm.response.json()).to.have.property("error");
    });
}