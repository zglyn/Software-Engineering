pm.test("Status code is valid (200 or 404)", () => {
    pm.expect([200, 404]).to.include(pm.response.code);
});

if (pm.response.code === 200) {
    const data = pm.response.json();
    pm.test("Team has correct structure", () => {
        pm.expect(data).to.have.property("team_id");
    });
}

if (pm.response.code === 404) {
    pm.test("Error message exists", () => {
        const data = pm.response.json();
        pm.expect(data).to.have.property("error");
    });
}