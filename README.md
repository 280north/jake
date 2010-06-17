Jake
====

Jake is a build tool similar to Make and Rake, but written in and for JavaScript. It's a port of Ruby's [Rake](http://rake.rubyforge.org/), which is inspired by the classic [Make](http://en.wikipedia.org/wiki/Make_(software\)) tool.

Currently it runs on the [Narwhal](http://narwhaljs.org/) server-side JavaScript platform, but is intended to support any compliant [CommonJS](http://commonjs.org/) system as it matures.

API
---

The API is very similar to the Rake API, though with JavaScript syntax.

- `jake.task(name, [dependencies], [action])`

Declares a task called "name", with an optional array of dependent tasks, and optional function to perform.

- `jake.file(path, [dependencies], [action])`

Like `task`, but only runs the action if the target file ("name") doesn't exist or was last modified before at least on dependency.

- jake.directory(directoryPath)
- jake.filedir(path, [dependencies], action)

*TODO: better API docs*

Example "Jakefile"
------------------

    var jake = require("jake");
    
    // prints "default":
    jake.task("default", function(t) {
        print(t.name());
    });
    
    // runs tasks "bar" and "baz"
    jake.task("foo", ["bar", "baz"]);
    
    // only runs if "bar" is older than "bar.source" or non-existant
    jake.file("bar", ["bar.source"], function() {
        // stuff to compile "bar.source" to "bar"
    });
    
    // does nothing
    jake.task("baz");

Example Usage
-------------

    # runs "default" task if no task names are given
    jake
    
    # runs "bar", "baz" dependent tasks, then "foo" task
    jake foo
    
    # runs "bar", "baz", "foo", and "default" tasks
    jake foo default
