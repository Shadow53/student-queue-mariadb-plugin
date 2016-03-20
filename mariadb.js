/**
 * Created by michael on 3/7/16.
 */
var Client = require("mariasql");
var Promise = require("promise");
var crypto = require("crypto");

function checkName(name){
    if (typeof name !== "string" || name.toLowerCase() === "queues"){
        return false;
    }
    else{
        var valid = /(^\w)\w+/;
        return valid.test(name);
    }
}


function RequestDB(obj) {
    if (this instanceof RequestDB){
        var that = this;

        if (!(obj.hasOwnProperty("host") && obj.hasOwnProperty("user") && obj.hasOwnProperty("password") &&
            obj.hasOwnProperty("db") && obj.hasOwnProperty("table"))) {
            throw new Error("Missing one or more of the required options: host, user, password, db, table")
        }

        if (!checkName(obj.table)){
            throw new Error("Invalid table name");
        }

        that.table = "`" + obj.table + "`";

        that.client = new Client(obj);

        return Object.freeze(that);
    }
    else return new RequestDB(obj);
}

RequestDB.prototype.reset = function(){
    var that = this;
    return new Promise(function(resolve, reject){
        that.client.query("TRUNCATE " + that.table, function(err){
            if (err) reject(err);
            else resolve();
        });
    });
};

RequestDB.prototype.add = function(request){
    var that = this;

    if (!(request.hasOwnProperty("name") && request.hasOwnProperty("id") && request.hasOwnProperty("problem"))){
        return new Promise(function(resolve, reject){
            reject(new Error("Missing one of the required properties: name, id, problem"));
        });
    }

    var internal = new Promise(function(resolve, reject){
        that.client.query("SELECT * FROM " + that.table + " WHERE studentid = :id LIMIT 1",
            {id: request.id}, function(err, rows){
                if (err) reject(err);
                else {
                    if (rows.length > 0){
                        reject(new Error("Record with key already exists"));
                    }
                    else {
                        resolve();
                    }
                }
            });
    });

    return new Promise(function(resolve, reject){
        internal.then(
            function(){
                that.client.query("INSERT INTO " + that.table + " (studentid, name, description) VALUES (:id, :name, :problem)",
                    {id: request.id, name: request.name, problem: request.problem}, function (err, result) {
                        if (err) reject(err);
                        else resolve();
                    });
            },
            function(err){
                reject(err);
            }
        );
    });
};

RequestDB.prototype.remove = function(rmId){
    var that = this;

    return new Promise(function(resolve, reject){
        that.client.query("DELETE FROM " + that.table + "WHERE `studentid` = :id", {id: rmId},
            function(err, result){
                if (err) reject(err);
                else resolve();
            });
    });
};

RequestDB.prototype.getAll = function () {
    var that = this;

    return new Promise(function(resolve, reject){
        that.client.query("SELECT * FROM " + that.table + " ORDER BY timestamp ASC",
            function (err, result) {
                if (err) reject(err);
                else resolve(result);
            });
    });
};

function ConfigDB(obj){
    if (this instanceof ConfigDB){
        var that = this;
        if (!(obj.hasOwnProperty("host") && obj.hasOwnProperty("user") && obj.hasOwnProperty("password") &&
            obj.hasOwnProperty("db"))) {
            throw new Error("Missing one or more of the required options: host, user, password, db")
        }

        that.table = Client.escape("queues");

        that.host = obj.host;
        that.user = obj.user;
        that.password = obj.password;
        that.db = obj.db;

        // This gets set in load()
        that.queues = {};

        that.client = new Client(obj);

        return Object.freeze(that);
    }
    else return new ConfigDB(obj);
}

ConfigDB.prototype.createConfigTable = function(){
    var that = this;

    var created = new Promise(function(resolve, reject){
        that.client.query(
            "CREATE TABLE IF NOT EXISTS " + that.table + " (" +
            "`name` varchar(30) NOT NULL, " +
            "`table_name` varchar(30) NOT NULL, " +
            "`hash` varchar(44) NOT NULL, " +
            "`description` varchar(1000) NULL, " +
            "PRIMARY KEY (`table_name`), " +
            "UNIQUE KEY `name` (`name`)" +
            ") ENGINE=MyISAM DEFAULT CHARSET=latin1", function (err) {
            if (err) reject(err);
            else resolve();
        });
    });

    return new Promise(function(resolve, reject){
        created.then(
            function(){
                that.client.query("SELECT * FROM " + that.table + " WHERE `name` = 'admin' LIMIT 1",
                    function(err, result){
                        if (err) reject(err);
                        else {
                            if (result.length > 0) resolve();
                            else {
                                that.client.query("INSERT INTO " + that.table +
                                    " (`name`, `hash`) VALUES ('admin', '" + hashPassword(password) + "')",
                                    function(err){
                                        if (err) reject(err);
                                        else resolve();
                                    });
                            }
                        }
                    });
            },
            function(err){
                reject(err);
            }
        );
    });
};

ConfigDB.prototype.addNewQueue = function(obj){
    var that = this;

    if (!(obj.hasOwnProperty("name") && obj.hasOwnProperty("password"))) {
        return new Promise(function(resolve, reject){
            reject(new Error("Missing one or more of the required options: name, password"));
        });
    }

    if (!obj.hasOwnProperty("table_name") || typeof obj.table_name !== "string") {
        obj.table_name = obj.name;
    }

    if (!checkName(obj.table_name)){
        return new Promise(function(resolve, reject){
            reject(new Error("Invalid table name: " + obj.table_name));
        });
    }

    var doesExist = new Promise(function(resolve, reject){
        that.client.query("SELECT * FROM " + that.table + " WHERE `name` = :name LIMIT 1",
            {name: obj.name}, function (err, result){
                if (err) {
                    reject(err);
                    return;
                }

                if (result.length > 0){
                    reject(new Error("Queue with name " + obj.name + " already exists"));
                }
                else {
                    resolve();
                }
            });
    });

    var QTableCreate = new Promise(function(resolve, reject){
        doesExist.then(
            function() {
                that.client.query("CREATE TABLE `" + obj.table_name + "` (" +
                    "`studentid` varchar(15) NOT NULL, " +
                    "`name` varchar(255) NOT NULL, " +
                    "`description` varchar(1000) NOT NULL, " +
                    "`timestamp` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP, " +
                    "PRIMARY KEY (`studentid`)" +
                    ") ENGINE=MyISAM DEFAULT CHARSET=latin1",
                    function (err) {
                        if (err) reject(err);
                        else resolve();
                    });
            },
            function(err) {
                reject(err);
            });
    });

    return new Promise(function(resolve, reject){
        QTableCreate.then(
            function(){
                var hasDesc = obj.hasOwnProperty("description");

                var sql = that.client.prepare("INSERT INTO " + that.table + " (`name`, `hash`, `table_name`" +
                    (hasDesc ? ", `description`" : "") +
                    ") VALUES (:name, :hash, :table_name" +
                    (hasDesc ? ", :description" : "") + ") ");

                var props = {name: obj.name, hash: hashPassword(obj.password), table_name: obj.table_name};
                if (hasDesc) props.description = obj.description;

                that.client.query(sql(props), function (err, result) {
                    if (err) reject(err);
                    else {
                        that.load();
                        resolve();
                    }
                });
            },
            function(err){
                reject(err);
            }
        );
    });
};

// May need to manually escape "arg" depending on if node-mariasql escapes it correctly
function updateArg(name, arg, val, that){
    return new Promise(function(resolve, reject){
        if (typeof name !== "string" || typeof val !== "string"){
            reject(new Error("Missing one of the required arguments: name, " + arg));
        }
        else {
            that.client.query("UPDATE " + that.table + " SET " + Client.escape(arg) + " = :val WHERE `name` = :name LIMIT 1",
                {val: val, name: name}, function (err) {
                    if (err) reject(err);
                    else resolve();
                });
        }
    });
}

function hashPassword(password) {
    var pwHash = crypto.createHash('sha256');
    pwHash.update(password);
    return pwHash.digest("base64");
}

ConfigDB.prototype.setHash = function (name, password) {
    return updateArg(name, "hash", hashPassword(password), this);
};

ConfigDB.prototype.setQueueName = function (oldName, newName) {
    var that = this;

    var oldExist = new Promise(function(resolve, reject){
        if (typeof oldName !== "string" || typeof newName !== "string"){
            reject(new Error("Missing valid options: oldName, newName"));
        }
        else {
            that.client.query("SELECT * FROM " + that.table + " WHERE `name` = :name LIMIT 1",
                {name: oldName}, function(err, result){
                    if (result.length > 0) resolve();
                    else reject(new Error("Queue with name " + oldName + " does not exist"));
                });
        }
    });

    var newExist = new Promise(function(resolve, reject){
        oldExist.then(
            function(){
                if (!checkName(newName)){
                    reject(new Error("New name does not meet name requirements: alphanumeric or underscore only"));
                }
                else {
                    that.client.query("SELECT * FROM " + that.table + " WHERE `name` = :name LIMIT 1",
                        {name: newName}, function(err, result){
                            if (result.length === 0) resolve();
                            else reject(new Error("Queue with name " + newName + " already exists"));
                        });
                }
            },
            function(err){
                reject(err);
            }
        );
    });

    return new Promise(function(resolve, reject){
        newExist.then(
            function(){
                that.connection.query("UPDATE " + that.table + "SET `name` = :new WHERE `name` = :old",
                    {new: newName, old: oldName}, function(err){
                        if (err) reject(err);
                        else resolve();
                    });
            },
            function(err){
                if (newName === oldName) resolve(); // Assuming a failure here comes from it existing
                else reject(err);
            }
        );
    });
};

ConfigDB.prototype.setDescription = function (name, desc) {
    return updateArg(name, "description", desc, this);
};

ConfigDB.prototype._getHash = function (name) {
    var that = this;
    return new Promise(function(resolve, reject){
        if (that.queues.hasOwnProperty(name)) {
            that.client.query("SELECT `hash` FROM " + that.table + " WHERE `name` = :name LIMIT 1",
                {name: name}, function (err, result) {
                    if (err) reject(err);
                    else resolve(result[0].hash);
                });
        }
        else {
            reject(new Error("No queue found with name " + name));
        }
    });
};

ConfigDB.prototype.deleteQueue = function (name, table_name) {
    var that = this;

    table_name = (table_name === undefined ? name : table_name);

    var del = new Promise(function(resolve, reject){
        that.client.query("DROP TABLE `" + table_name + "`", function (err) {
            if (err) reject(err);
            else resolve();
        });
    });

    return new Promise(function(resolve, reject){
        del.then(
            function(){
                that.client.query("DELETE FROM " + that.table + " WHERE `name` = :name",
                    {name: name}, function(err){
                        if (err) reject(err);
                        else resolve();
                    });
            },
            function(err){
                reject(err);
            }
        );
    });
};

ConfigDB.prototype.getAllQueues = function () {
    var that = this;

    return new Promise(function(resolve, reject){
        that.client.query("SELECT `name`, `description` FROM " + that.table + " WHERE `name` != 'admin' ORDER BY `name` ASC",
            function (err, result) {
                if (err) reject(err);
                else resolve(result);
            });
    });
};

ConfigDB.prototype.load = function () {
    var that = this;
    return new Promise(function(resolve, reject){
        that.client.query("SELECT `name`, `table_name` FROM " + that.table + " ORDER BY `name` DESC",
            function (err, result) {
                if (err) reject(err);
                else {
                    that.queues = {};
                    result.forEach(function (queue) {
                        console.log(queue);
                        that.queues[queue.name] = new RequestDB({
                            host: that.host,
                            user: that.user,
                            password: that.password,
                            db: that.db,
                            table: queue.table_name
                        });
                    });
                    resolve();
                }
            });
    });
};

ConfigDB.prototype.validatePassword = function (queueName, password) {
    var that = this;

    var getHash = that._getHash(queueName);

    return new Promise(function(resolve, reject){
        getHash.then(
            function (hash) {
                var newHash = hashPassword(password);
                if (hash === newHash)
                    resolve();
                else reject(new Error("Password did not match"));
            },
            function(err){
                reject(err);
            }
        );
    });
};

module.exports = ConfigDB;