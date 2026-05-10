# Software Engineering I

## Testing

These automated tests were developed and validated using the **Postman** desktop application to ensure API reliability and data integrity.

### Backend
The backend API is tested across four main modules. Each test script validates specific status codes ($200$, $400$, or $404$) and ensures the JSON response body matches the expected schema.

#### 1. Coaches Module
* **`addCoach.test.js`**: Validates that new coaches are added successfully with a "success" message.
* **`deleteCoach.test.js`**: Ensures the API returns a "removed" confirmation when a coach record is deleted.
* **`getCoaches.test.js`**: Checks that the list of coaches is returned as a valid object.

#### 2. Players Module
* **`createPlayer.test.js`**: Verifies that creating a player returns the updated player data.
* **`deletePlayer.test.js`**: Confirms that the deletion of a player returns a proper confirmation message.
* **`getAllPlayers.test.js`**: Ensures the endpoint returns a full array of player data.

#### 3. Teams Module
* **`getAllTeams.test.js`**: Validates a $200$ OK status and checks that each team object contains a `team_id`.
* **`getTeamById.test.js`**: Tests both success paths (structure validation) and failure paths ($404$ error property checks).

#### 4. Users Module
* **`getUsers.test.js`**: Confirms that user data retrieval is successful and the response is formatted as a valid object.

### How to Run These Tests
1. **Open Postman** and click the **Import** button.
2. Drag and drop the `postman-tests` folder into the import window.
3. Set your **Environment Variables** (specifically the `base_url` for your backend server).
4. Use the **Collection Runner** to execute all tests in a folder at once and view the pass/fail results.