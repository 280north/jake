
// Copyright 2009 280 North, Inc. (francisco@280north.com)
// Copyright 2003, 2004, 2005, 2006, 2007, 2008, 2009 by Jim Weirich (jim.weirich@gmail.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to
// deal in the Software without restriction, including without limitation the
// rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
// sell copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
// FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
// IN THE SOFTWARE.
//

var SYSTEM = require("system");

var JAKE = require("../jake");

var Task = function(/*String*/ aName, /*Application*/ anApplication) {
    this._name = aName;
    this._prerequisites = [];
    this._actions = [];
    this._alreadyInvoked = false;
    this._fullComment = null;
    this._comment = null;
    //this.lock = Monitor.new
    this._application = anApplication;
    this._scope = anApplication.currentScope();
    this._argumentNames = [];
}

Task.prototype.toString = function() {
    return "Task (" + this.name() + ")";
}

Task.prototype.name = function() {
    return this._name;
}

Task.prototype.fullComment = function() {
    return this._fullComment || "";
}

Task.prototype.comment = function() {
    return this._comment || "";
}

Task.prototype.prerequisites = function() {
    return this._prerequisites;
}

Task.prototype.actions = function() {
    return this._actions;
}

Task.prototype.application = function() {
    return this._application;
}

Task.prototype.enhance = function(/*Array|FileList*/ prerequisites, /*Function*/ anAction) {
    if (prerequisites)
        this._prerequisites = this._prerequisites.concat(prerequisites.toArray ? prerequisites.toArray() : prerequisites);

    if (anAction)
        this._actions.push(anAction);
}

Task.prototype.reenable = function() {
    this._alreadyInvoked = false;
}

Task.prototype.clear = function() {
    this.clearPrerequisites();
    this.clearActions();
}

Task.prototype.clearPrerequisites = function() {
    this._prerequisites = [];
}

Task.prototype.clearActions = function() {
    this._actions = [];
}

Task.prototype.invoke = function() {
    var taskArguments = new TaskArguments(this._argumentNames, Array.prototype.slice.apply(arguments));

    this.invokeWithCallChain(taskArguments, InvocationChain.EMPTY);
}

// Same as invoke, but explicitly pass a call chain to detect
// circular dependencies.
Task.prototype.invokeWithCallChain = function(taskArguments, anInvocationChain) {
    var newChain = InvocationChain.append(this, anInvocationChain);
//      @lock.synchronize do
//        if application.options.trace
//          puts "** Invoke #{name} #{format_trace_flags}"
//        end

    if (this._alreadyInvoked)
        return;

    this._alreadyInvoked = true;

    this.invokePrerequisites(taskArguments, newChain);

    if (this.isNeeded())
        this.execute(taskArguments);
}

// Invoke all the prerequisites of a task.
Task.prototype.invokePrerequisites = function(taskArguments, invocationChain) {
    this._prerequisites.forEach(function(/*String*/ aPrerequisiteName) {
        var prerequisite = this._application.lookupTask(aPrerequisiteName, this._scope);

        prerequisiteArguments = taskArguments.newScope(prerequisite.argumentNames());
        prerequisite.invokeWithCallChain(prerequisiteArguments, invocationChain);
    }, this);
}

Task.prototype.setArgumentNames = function(argumentNames) {
    this._argumentNames = argumentNames;
}

Task.prototype.argumentNames = function() {
    return this._argumentNames;
}

// Execute the actions associated with this task.
Task.prototype.execute = function(taskArguments) {
    taskArguments = taskArguments || EMPTY_TASK_ARGS;

//      if application.options.dryrun
//        puts "** Execute (dry run) #{name}"
//        return
//      end
//      if application.options.trace
//        puts "** Execute #{name}"
//      end

//      application.enhance_with_matching_rule(name) if @actions.empty?

    this._actions.forEach(function(anAction) {
        anAction(this);
        //anAction(This, args)
    }, this);
}

Task.prototype.isNeeded = function() {
    return true;
}

Task.prototype.timestamp = function() {
    if (this._prerequisites.length <= 0)
        return new Date().getTime();

    return Math.max.apply(null, this._prerequisites.map(function(/*String*/ aPrerequisiteName) {
        return this._application.lookupTask(aPrerequisiteName, this._scope).timestamp();
    }, this));
}

Task.clear = function() {
    JAKE.application.clear();
}

Task.tasks = function() {
    return JAKE.application.tasks();
}

Task.taskNamed = function(/*String*/ aTaskName) {
    return JAKE.application.taskWithName(aTaskName);
}

Task.taskWithNameIsDefined = function(/*String*/ aTaskName) {
    return !!JAKE.application.lookupTaskWithName(aTaskName);
}

Task.defineTask = function() {
    var args = [this];
    var application = JAKE.application();

    // Can't simply use concat because we don't want to flatten inner arrays.
    Array.prototype.forEach.call(arguments, function(object) {
        args.push(object);
    });

    return application.defineTask.apply(application, args);
}

Task.scopeName = function(/*Array<String>*/ aScope, /*String*/ aTaskName) {
    return aScope.concat(aTaskName).join(':');
}
/*
    # Track the last comment made in the Rakefile.
    attr_accessor :last_description
    alias :last_comment :last_description    # Backwards compatibility
*/

var TaskArguments = function(/*Array<String>*/ names, /*Array<Object>*/ values, /*TaskArguments*/ aParent) {
    this._names = names.slice();
    this._parent = aParent;
    this._hash = { };

    this._names.forEach(function(/*String*/ aName, /*Number*/ anIndex) {
        if (values[anIndex] !== undefined)
            this._hash[aName] = values[anIndex];
    }, this);
}

TaskArguments.prototype.newScope = function(/*Array<String>*/ names) {
    var values = names.map(function(/*String*/ aName) {
        return this.lookup(aName);
    }, this);

    return new TaskArguments(names, values, this);
}

TaskArguments.prototype.withDefaults = function(/*Object*/ defaults) {
    var hash = this._hash;

    for (key in defaults)
        if (defaults.hasOwnProperty(key) && !hash.hasOwnProperty(key))
            hash[key] = defaults[key];
}

TaskArguments.prototype.forEach = function(/*Function*/ aFunction, /*Object*/ thisObject) {
    if (!aFunction)
        return;

    var hash = this._hash;

    if (typeof thisObject === "undefined")
        thisObject = aFunction;

    for (key in hash)
        aFunction.apply(thisObject, [key, hash[key]]);
}

TaskArguments.prototype.toHash = function() {
    return this._hash;
}

TaskArguments.prototype.toString = function() {
    return this._hash;
}

TaskArguments.prototype.lookup = function(/*String*/ aName) {
    var hash = this._hash;

    if (hash.hasOwnProperty(aName))
        return hash[Name];

    var env = SYSTEM.env;

    if (env.hasOwnProperty(aName))
        return env[aName];

    var upperCaseName = aName.toUpperCase();

    if (env.hasOwnProperty(upperCaseName))
        return env[upperCaseName];

    if (this._parent)
        return this._parent.lookup(aName);

    return null;
}

var EMPTY_TASK_ARGS = new TaskArguments([], []);

var InvocationChain = function(aValue, /*InvocationChain*/ aTail) {
    this._value = aValue;
    this._tail = aTail;
}

InvocationChain.prototype.isMember = function(/*Object*/ anObject) {
    return this._value == anObject || this._tail.isMember(anObject);
}

InvocationChain.prototype.append = function(/*Object*/ anObject) {
    if (this.isMember(anObject))
        throw "Circular dependency detected: " + this + " => " + this._value;

    return new InvocationChain(this._value, this);
}

InvocationChain.prototype.toString = function() {
    return this.prefix() + this._value;
}

InvocationChain.append = function(aValue, /*InvocationChain*/ aChain) {
    return aChain.append(aValue);
}

InvocationChain.prototype.prefix = function() {
    return this._tail + " => ";
}

var EmptyInvocationChain = function() {
}

EmptyInvocationChain.prototype.isMember = function(/*Object*/ anObject) {
    return false;
}

EmptyInvocationChain.prototype.append = function(/*Object*/ aValue) {
    return new InvocationChain(aValue, this);
}

EmptyInvocationChain.prototype.toString = function() {
    return "TOP";
}

InvocationChain.EMPTY = new EmptyInvocationChain;

// EXPORTS
exports.Task = Task;
