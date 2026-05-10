pm.test("Status code is 200", () => {
    pm.response.to.have.status(200);
});

pm.test("Delete confirmation message exists", () => {
    const data = pm.response.json();
    pm.expect(data).to.have.property("message");
});