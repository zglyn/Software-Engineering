# Software Engineering I

## Testing

**Backend** - These automated tests were developed and validated using the **Postman** desktop application and **Newman** CLI to ensure API reliability and data integrity.  
**Frontend** - Component and route testing utilizing **RTL (React Testing Library)**, **Vitest**, and **React Router Library**.

---

### Backend

#### Description of Tests
The backend API is verified across four core modules using 17 assertions to validate status codes (200, 201, 400, or 404) and JSON schema integrity:
* **Coaches Module**: Validates the end-to-end lifecycle of staff management, including adding new coaches and performing verified deletions.
* **Players Module**: Verifies successful player creation (201 Created) and ensures the database correctly stores and retrieves player roster arrays.
* **Teams Module**: Confirms that every team object contains a valid `team_id` and that specific team detail lookups return the expected data structure.
* **User Management**: Ensures that user data retrieval is successful and formatted correctly for frontend consumption.
* **NBA API Integration**: Tests real-world data fetching for the 2025-26 season to ensure the game-log parser is functioning correctly.

#### How to run the test
1. **Ensure you are in the backend folder**:
   ```bash
   cd backend
2. **Start the server**: Open a terminal window and run:
   ```bash
   node server.js
3. **Run the tests:** Open a separate terminal window and run:
   ```bash
   npm test

### Frontend

#### Description of Tests
The frontend suite consists of 46 automated tests across 14 route files to ensure a seamless and error-free user experience:

* **Route Rendering**: Ensures critical pages like `Profile`, `Stats`, `Video`, and `Management` render correctly without crashing during navigation.
* **Interactive Flows**: Validates multi-step processes like user onboarding and team creation, ensuring buttons and inputs respond correctly to user data.
* **Comparison Logic**: Specifically tests the `ComparePage` to verify the logic for switching between "Player" and "Team" comparison modes.
* **State Management**: Confirms that loading states are displayed during data fetching and that the UI updates correctly after form submissions or role assignments.

#### Steps to run the tests
1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
2. **Run the Test Command**:
   ```bash
   npm run test
These steps will run and execute the test suite
