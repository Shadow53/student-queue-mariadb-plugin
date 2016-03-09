# student-queue-mysql-plugin
MySQL-compatible Database plugin for my student-queue project

This project makes use of the [mysql](https://www.npmjs.com/package/mysql) and [promised-io](https://www.npmjs.com/package/promised-io) npm plugins. It serves as an easy-to-use interface with which to use a MySQL database with the [student-queue](https://github.com/Shadow53/student-queue) program.

## Installation
`npm install student-queue-mysql-plugin`

## Usage

### ConfigDB
The ConfigDB is an interface with server configuration, mainly adding, removing, and otherwise maintaining various queues.

##### Constructor
```javascript
var mysql = require("student-queue-mysql-plugin");
var config = new mysql.ConfigDB({
  host: "localhost",
  user: "myUser",
  password: "P@SSW0RD",
  database: "studentqueue",
  table: "config"
});
```
##### Usage

```javascript
config.createConfigTable(); // Does nothing if it exists
/*
+-------------+----------------------------------------------+-----------------------------------+
| name        | password                                     | description                       |
+-------------+----------------------------------------------+-----------------------------------+
*/

// This adds an entry to the "config" table and creates a table called "testQueue" to act as the actual queue.
config.addNewQueue({
  name: "testQueue",
  // This is the sha256sum provided by the "login" script in student-queue
  passwordHash: login.hashPassword("password"),
  description: "A testing queue for demonstration", // Optional
  // tableName: "testing" // Also optional. Defaults to the value of "name"
});
/*
+-------------+----------------------------------------------+-----------------------------------+
| name        | password                                     | description                       |
+-------------+----------------------------------------------+-----------------------------------+
| testQueue   | XohImNooBHFR0OVvjcYpJ3NgPQ1qq73WKhHvch0VQtg= | A testing queue for demonstration |
+-------------+----------------------------------------------+-----------------------------------+
*/

config.updateQueueName("testQueue", "cheese");
/*
+----------+----------------------------------------------+-----------------------------------+
| name     | password                                     | description                       |
+----------+----------------------------------------------+-----------------------------------+
| cheese   | XohImNooBHFR0OVvjcYpJ3NgPQ1qq73WKhHvch0VQtg= | A testing queue for demonstration |
+----------+----------------------------------------------+-----------------------------------+
*/

config.updatePasswordHash("cheese", login.hashPassword("PASSWORD"));
/*
+----------+----------------------------------------------+-----------------------------------+
| name     | password                                     | description                       |
+----------+----------------------------------------------+-----------------------------------+
| cheese   | C+ZK6J3dJOIlQ03pXVAXETObru4Y8Am6m0NpryfTDWA= | A testing queue for demonstration |
+----------+----------------------------------------------+-----------------------------------+
*/

config.updateDescription("cheese", "This is a demonstration");
/*
+----------+----------------------------------------------+-------------------------+
| name     | password                                     | description             |
+----------+----------------------------------------------+-------------------------+
| cheese   | C+ZK6J3dJOIlQ03pXVAXETObru4Y8Am6m0NpryfTDWA= | This is a demonstration |
+----------+----------------------------------------------+-------------------------+
*/

// Here the second argument is only required if the table name is not the same as the queue name
// It's a good idea to include it, just in case
config.deleteQueue("cheese", "testQueue");
/*
+----------+----------------------------------------------+-------------------------+
| name     | password                                     | description             |
+----------+----------------------------------------------+-------------------------+
*/
```

### RequestDB
The RequestDB is an interface to a particular queue on the server. It allows you to add and remove requests, get all requests, and empty the queue.

##### Constructor
```javascript
var mysql = require("student-queue-mysql-plugin");
var queueDB = new mysql.RequestDB({
  host: "localhost",
  user: "myUser",
  password: "P@SSW0RD",
  database: "studentqueue",
  table: "testQueue" // This table would have been created by config.addNewQueue()
});
```

##### Usage

```javascript
// A request object was received from a student
/*
request = {
  id: 000001,
  name: "Joe Smith",
  problem: "EVERYTHING IS BORKED!!!"
}
*/
queueDB.add(request);
/*
+-----------+-----------+-------------------------+---------------------+
| studentid | name      | description             | timestamp           |
+-----------+-----------+-------------------------+---------------------+
| 000001    | Joe Smith | EVERYTHING IS BORKED!!! | 2016-03-08 17:51:00 |
+-----------+-----------+-------------------------+---------------------+
*/

queueDB.remove("000001");
/*
+-----------+-----------+-------------------------+---------------------+
| studentid | name      | description             | timestamp           |
+-----------+-----------+-------------------------+---------------------+
*/

/*
request1 = {
  id: 000001,
  name: "Joe Smith",
  problem: "EVERYTHING IS BORKED!!!"
}

request2 = {
  id: 000002,
  name: "Sally Jane",
  problem: "I don't understand how the plugin works yet"
}
*/
queueDB.add(request1);
queueDB.add(request2);
/*
+-----------+------------+---------------------------------------------+---------------------+
| studentid | name       | description                                 | timestamp           |
+-----------+------------+---------------------------------------------+---------------------+
| 000001    | Joe Smith  | EVERYTHING IS BORKED!!!                     | 2016-03-08 17:51:00 |
+-----------+------------+---------------------------------------------+---------------------+
| 000002    | Sally Jane | I don't understand how the plugin works yet | 2016-03-08 17:53:00 |
+-----------+------------+---------------------------------------------+---------------------+
*/

queueDB.remove("000001");
/*
+-----------+------------+---------------------------------------------+---------------------+
| studentid | name       | description                                 | timestamp           |
+-----------+------------+---------------------------------------------+---------------------+
| 000002    | Sally Jane | I don't understand how the plugin works yet | 2016-03-08 17:53:00 |
+-----------+------------+---------------------------------------------+---------------------+
*/

// Let's add Joe back in
queueDB.add(request1);
/*
+-----------+------------+---------------------------------------------+---------------------+
| studentid | name       | description                                 | timestamp           |
+-----------+------------+---------------------------------------------+---------------------+
| 000001    | Joe Smith  | EVERYTHING IS BORKED!!!                     | 2016-03-08 17:51:00 |
+-----------+------------+---------------------------------------------+---------------------+
| 000002    | Sally Jane | I don't understand how the plugin works yet | 2016-03-08 17:53:00 |
+-----------+------------+---------------------------------------------+---------------------+
*/

var items = queueDB.getAll();
/*
items = [{id: "000001", name: "Joe Smith", problem: "EVERYTHING IS BORKED!!!"},
         {id: "000002", name: "Sally Jane", problem: "I don't understand how the plugin works yet"}];
*/

queueDB.reset(); // Empties/resets the queue
+-----------+------------+--------------------+---------------------+
| studentid | name       | description        | timestamp           |
+-----------+------------+--------------------+---------------------+
```