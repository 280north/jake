#!/usr/bin/env narwhal

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

var FILE = require("file"),
    FileTask = require("jake/filetask").FileTask;

TaskManager = function()
{
    this._tasks = { };
    this._rules = [];
    this._scope = [];
//      @last_description = nil
}
/*
    def create_rule(*args, &block)
      pattern, arg_names, deps = resolve_args(args)
      pattern = Regexp.new(Regexp.quote(pattern) + '$') if String === pattern
      @rules << [pattern, deps, block]
    end
*/

TaskManager.prototype.defineTask = function(aTaskClass, aTaskName)
{
    if (arguments.length < 1)
        throw "No class passed to Task.defineTask";

    if (arguments.length < 2)
        throw "No name passed to Task.defineTask";

    aTaskName = aTaskClass.scopeName(this._scope, aTaskName);

    var task = this.intern(aTaskClass, aTaskName),
        result = this.resolveArguments(Array.prototype.slice.apply(arguments, [2]));

    task.setArgumentNames(result[0]);
//task.add_description(@last_description)
//@last_description = nil
    task.enhance(result[1], result[2]);

    return task;
}

// Lookup a task.  Return an existing task if found, otherwise
// create a task of the current type.
TaskManager.prototype.intern = function(/*Function*/ aTaskClass, /*String*/ aTaskName)
{
    var task = this._tasks[aTaskName];

    if (!task)
    {
        task = new aTaskClass(aTaskName, this);
        this._tasks[aTaskName] = task;
    }

    return task;
}

TaskManager.prototype.lookupTask = function(/*String*/ aTaskName, /*Array<String>*/ scopes)
{
    var task = this.lookup(aTaskName, scopes) || /* enhance_with_matching_rule(task_name) or  ||*/ this.synthesizeFileTask(aTaskName);

    if (!task)
        throw "Don't know how to build task '" + aTaskName + "'";

    return task;
}

TaskManager.prototype.synthesizeFileTask = function(/*String*/ aTaskName)
{
    if (!FILE.exists(aTaskName))
        return null;

    return this.defineTask(FileTask, aTaskName);
}

// Resolve the arguments for a task/rule.  Returns a triplet of
// [task_name, arg_name_list, prerequisites].
//
// The patterns recognized by this argument resolving function are:
//
//   task(taskName, action)
//   task(taskName, [dependency])
//   task(taskName, [dependency], action)
//   task(taskName, [argumentName], [dependency], action)
//
TaskManager.prototype.resolveArguments = function(args)
{
    var action = null;

    if (args.length && (typeof args[args.length - 1] === "function"))
        action = args.pop();

    var dependencies = [];

    if (args.length)
        dependencies = args.pop();

    var argumentNames = [];

    if (args.length)
        argumentNames = args.pop();

    return [argumentNames, dependencies, action];
}

TaskManager.prototype.tasks = function()
{
    var tasks = Object.keys(this._tasks);

    tasks.sort(function(lhs, rhs)
    {
        if (lhs < rhs)
            return -1;

        else if (lhs > rhs)
            return 1;

        return 0;
    } );

    return tasks;
}

// List of all the tasks defined in the given scope (and its
// sub-scopes).
TaskManager.prototype.tasksInScope = function(/*Array<String>*/ aScope)
{
    var prefix = aScope.join(":"),
        regexp = new Regexp("^" + prefix + ":");

    return this._tasks.filter(function(/*Task*/ aTask)
    {
        return !!aTask.name().match(regexp);
    });
}

// Clear all tasks in this application.
TaskManager.prototype.clear = function()
{
    this._tasks = [];
    this._rules = [];
}

// Lookup a task, using scope and the scope hints in the task name.
// This method performs straight lookups without trying to
// synthesize file tasks or rules.  Special scope names (e.g. '^')
// are recognized.  If no scope argument is supplied, use the
// current scope.  Return nil if the task cannot be found.
TaskManager.prototype.lookup = function(/*String*/ aTaskName, /*Array<String>*/ initialScope)
{
    if (!initialScope)
        initialScope = this._scope;

    var scopes = initialScope,
        matches = null;

    if (aTaskName.match(/^jake:/))
    {
        scopes = [];
        aTaskName = aTaskName.replace(/^jake:/, "");
    }
    else if (matches = aTaskName.match(/^(\^+)/))
    {
        scopes = initialScope.slice(0, initialScope.length - matches[1].length);
        aTaskName = aTaskName.replace(/^(\^+)/, "");
    }

    return this.lookupInScope(aTaskName, scopes);
}

// Lookup the task name
TaskManager.prototype.lookupInScope = function(/*String*/ aTaskName, /*Array<String>*/ aScope)
{
    var count = aScope.length;

    while (count >= 0)
    {
        var task = this._tasks[aScope.slice(0, count).concat([aTaskName]).join(':')];

        if (task)
            return task;

        count--;
    }

    return null;
}

// Return the list of scope names currently active in the task
// manager.
TaskManager.prototype.currentScope = function()
{
    return this._scope.slice();
}
/*
    # Evaluate the block in a nested namespace named +name+.  Create
    # an anonymous namespace if +name+ is nil.
    def in_namespace(name)
      name ||= generate_name
      @scope.push(name)
      ns = NameSpace.new(self, @scope)
      yield(ns)
      ns
    ensure
      @scope.pop
    end

    private

    # Generate an anonymous namespace name.
    def generate_name
      @seed ||= 0
      @seed += 1
      "_anon_#{@seed}"
    end

    def trace_rule(level, message)
      puts "#{"    "*level}#{message}" if Rake.application.options.trace_rules
    end

    # Attempt to create a rule given the list of prerequisites.
    def attempt_rule(task_name, extensions, block, level)
      sources = make_sources(task_name, extensions)
      prereqs = sources.collect { |source|
        trace_rule level, "Attempting Rule #{task_name} => #{source}"
        if File.exist?(source) || Rake::Task.task_defined?(source)
          trace_rule level, "(#{task_name} => #{source} ... EXIST)"
          source
        elsif parent = enhance_with_matching_rule(source, level+1)
          trace_rule level, "(#{task_name} => #{source} ... ENHANCE)"
          parent.name
        else
          trace_rule level, "(#{task_name} => #{source} ... FAIL)"
          return nil
        end
      }
      task = FileTask.define_task({task_name => prereqs}, &block)
      task.sources = prereqs
      task
    end

    # Make a list of sources from the list of file name extensions /
    # translation procs.
    def make_sources(task_name, extensions)
      extensions.collect { |ext|
        case ext
        when /%/
          task_name.pathmap(ext)
        when %r{/}
          ext
        when /^\./
          task_name.ext(ext)
        when String
          ext
        when Proc
          if ext.arity == 1
            ext.call(task_name)
          else
            ext.call
          end
        else
          fail "Don't know how to handle rule dependent: #{ext.inspect}"
        end
      }.flatten
    end

  end # TaskManager
*/

// EXPORTS
exports.TaskManager = TaskManager;
