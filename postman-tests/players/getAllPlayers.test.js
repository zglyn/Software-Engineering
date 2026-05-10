pm.test("Status code is 200", () => {
    pm.response.to.have.status(200);
});

pm.test("Response is array", () => {
    pm.expect(pm.response.json()).to.be.an("array");
});