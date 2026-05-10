pm.test("Status code is 200", () => {
    pm.response.to.have.status(200);
});

pm.test("Response is an array", () => {
    const data = pm.response.json();
    pm.expect(data).to.be.an("array");
});

pm.test("Each team has team_id", () => {
    const data = pm.response.json();
    if (data.length > 0) {
        pm.expect(data[0]).to.have.property("team_id");
    }
});