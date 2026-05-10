pm.test("Valid status (200 or 400 or 404)", () => {
    pm.expect([200, 400, 404]).to.include(pm.response.code);
});

if (pm.response.code === 200) {
    pm.test("Coach added successfully", () => {
        const data = pm.response.json();
        pm.expect(data.message).to.include("success");
    });
}

if (pm.response.code !== 200) {
    pm.test("Error message exists", () => {
        pm.expect(pm.response.json()).to.have.property("error");
    });
}