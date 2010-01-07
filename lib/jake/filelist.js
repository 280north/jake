
var FILE = require("file");

/*
  # #########################################################################
  # A FileList is essentially an array with a few helper methods defined to
  # make file manipulation a bit easier.
  #
  # FileLists are lazy.  When given a list of glob patterns for possible files
  # to be included in the file list, instead of searching the file structures
  # to find the files, a FileList holds the pattern for latter use.
  #
  # This allows us to define a number of FileList to match any number of
  # files, but only search out the actual files when then FileList itself is
  # actually used.  The key is that the first time an element of the
  # FileList/Array is requested, the pending patterns are resolved into a real
  # list of file names.

    # == Method Delegation
    #
    # The lazy evaluation magic of FileLists happens by implementing all the
    # array specific methods to call +resolve+ before delegating the heavy
    # lifting to an embedded array object (@items).
    #
    # In addition, there are two kinds of delegation calls.  The regular kind
    # delegates to the @items array and returns the result directly.  Well,
    # almost directly.  It checks if the returned value is the @items object
    # itself, and if so will return the FileList object instead.
    #
    # The second kind of delegation call is used in methods that normally
    # return a new Array object.  We want to capture the return value of these
    # methods and wrap them in a new FileList object.  We enumerate these
    # methods in the +SPECIAL_RETURN+ list below.
 
    # List of array methods (that are not in +Object+) that need to be
    # delegated.
    ARRAY_METHODS = (Array.instance_methods - Object.instance_methods).map { |n| n.to_s }
 
    # List of additional methods that must be delegated.
    MUST_DEFINE = %w[to_a inspect]
 
    # List of methods that should not be delegated here (we define special
    # versions of them explicitly below).
    MUST_NOT_DEFINE = %w[to_a to_ary partition *]
 
    # List of delegated methods that return new array values which need
    # wrapping.
    SPECIAL_RETURN = %w[
      map collect sort sort_by select find_all reject grep
      compact flatten uniq values_at
      + - & |
    ]
 
    DELEGATING_METHODS = (ARRAY_METHODS + MUST_DEFINE - MUST_NOT_DEFINE).collect{ |s| s.to_s }.sort.uniq
 
    # Now do the delegation.
    DELEGATING_METHODS.each_with_index do |sym, i|
      if SPECIAL_RETURN.include?(sym)
        ln = __LINE__+1
        class_eval %{
          def #{sym}(*args, &block)
            resolve
            result = @items.send(:#{sym}, *args, &block)
            FileList.new.import(result)
          end
        }, __FILE__, ln
      else
        ln = __LINE__+1
        class_eval %{
          def #{sym}(*args, &block)
            resolve
            result = @items.send(:#{sym}, *args, &block)
            result.object_id == @items.object_id ? self : result
          end
        }, __FILE__, ln
      end
    end
*/

var DEFAULT_IGNORE_PATTERNS = [
      /(^|[\/\\])CVS([\/\\]|$)/,
      /(^|[\/\\])\.svn([\/\\]|$)/,
      /\.bak$/,
      /~$/
    ],
    DEFAULT_IGNORE_PROCS = [
      function(fn) { return /(^|[\/\\])core$/.test(fn) && !FILE.isDirectory(fn) }
    ];

// Create a file list from the globbable patterns given.  If you wish to
// perform multiple includes or excludes at object build time, use the
// "yield self" pattern.
//
// Example:
//   file_list = FileList.new('lib/**/*.rb', 'test/test*.rb')
//
//   pkg_files = FileList.new('lib/**/*') do |fl|
//     fl.exclude(/\bCVS\b/)
//   end
//
function FileList(/*Strings, vararg*/)
{
    this._pendingAdd = [];
    this._pending = false;
    this._excludedPatterns = DEFAULT_IGNORE_PATTERNS.slice();
    this._excludedProcs = DEFAULT_IGNORE_PROCS.slice();
    this._items = [];

    Array.prototype.forEach.call(arguments, function(anArgument)
    {
        this.include(anArgument);
    }, this);

    this.__defineGetter__("length", FileList.prototype.size);
}

["forEach", "filter", "map", "select",
"sort", "uniq", "push", "pop", "shift",
"unshift"].forEach(function(string)
{
    FileList.prototype[string] = function() {
        return (Array.prototype[string]).apply(this.items(), arguments);
    };
});

FileList.prototype.items = function()
{
    this.resolve();
    return this._items;
}

FileList.prototype.size = function()
{
    return this.items().length;
}

// Add file names defined by glob patterns to the file list.  If an array
// is given, add each element of the array.
//
// Example:
//   file_list.include("*.java", "*.cfg")
//   file_list.include %w( math.c lib.h *.o )
//
FileList.prototype.include = function(/*Strings | Arrays*/)
{
    // TODO: check for pending
    Array.prototype.forEach.apply(arguments, [function(/*String|Array|FileList*/ anObject)
    {
        if (Array.isArray(anObject))
            this.include.apply(this, anObject);

        else if (typeof anObject.toArray === "function")
            this.include.apply(this, anObject.toArray());

        else
            this._pendingAdd.push(anObject);
    }, this]);

    this._pending = true;

    return this;
}

FileList.prototype.add = FileList.prototype.include;

// Register a list of file name patterns that should be excluded from the
// list.  Patterns may be regular expressions, glob patterns or regular
// strings.  In addition, a block given to exclude will remove entries that
// return true when given to the block.
//
// Note that glob patterns are expanded against the file system. If a file
// is explicitly added to a file list, but does not exist in the file
// system, then an glob pattern in the exclude list will not exclude the
// file.
//
// Examples:
//   FileList['a.c', 'b.c'].exclude("a.c") => ['b.c']
//   FileList['a.c', 'b.c'].exclude(/^a/)  => ['b.c']
//
// If "a.c" is a file, then ...
//   FileList['a.c', 'b.c'].exclude("a.*") => ['b.c']
//
// If "a.c" is not a file, then ...
//   FileList['a.c', 'b.c'].exclude("a.*") => ['a.c', 'b.c']
//
FileList.prototype.exclude = function(/*Strings|Functions*/)
{
    Array.prototype.forEach.call(arguments, function(/*String|Function*/ anObject)
    {
        if (typeof anObject === "function")
            this._excludedProcs.push(anObject);

        else
            this._excludedPatterns.push(anObject);
    }, this);

    if (!this._pending)
        this._resolveExclude();

    return this;
}

// Clear all the exclude patterns so that we exclude nothing.
FileList.prototype.clearExclude = function()
{
    this._excludedPatterns = [];
    this._excludedProcs = [];

    return this;
}

/*
    # Define equality.
    def ==(array)
      to_ary == array
    end
*/

// Return the internal array object.
FileList.prototype.toArray = function()
{
    return this.items().slice();
}
 /*
    # Lie about our class.
    def is_a?(klass)
      klass == Array || super(klass)
    end
    alias kind_of? is_a?
 
    # Redefine * to return either a string or a new file list.
    def *(other)
      result = @items * other
      case result
      when Array
        FileList.new.import(result)
      else
        result
      end
    end
*/

// Resolve all the pending adds now.
FileList.prototype.resolve = function()
{
    if (this._pending)
    {
        this._pending = false;
        this._pendingAdd.forEach(function(aFilename)
        {
            this._resolveAdd(aFilename);
        }, this);

        this._pendingAdd = [];
        this._resolveExclude();
    }

    return this;
}

FileList.prototype._resolveAdd = function(aFilename)
{
    if (aFilename.match(/[\*?\[\{]/))
        this._addMatching(aFilename);
    else
        this._items.push(aFilename);
}

FileList.prototype._resolveExclude = function()
{
    this._items = this._items.filter(function(/*String*/ aFilename)
    {
        return !this._shouldExclude(aFilename);
    }, this);

    return this;
}

FileList.prototype._shouldExclude = function(aFilename)
{
    return this._excludedPatterns.some(function(aPattern)
    {
        if (aPattern.constructor === RegExp && aPattern.test(aFilename))
            return true;

        if (aPattern.match && aPattern.match(/[*?]/))
        {
            return FILE.fnmatch(aPattern, aFilename);
        }

        if (aFilename === aPattern)
            return true;
    }) ||
    this._excludedProcs.some(function(aFunction)
    {
        return aFunction.apply(this, [aFilename]);
    }, this);
}

/*
# Return a new FileList with the results of running +sub+ against each
# element of the oringal list.
#
# Example:
#   FileList['a.c', 'b.c'].sub(/\.c$/, '.o')  => ['a.o', 'b.o']
#
def sub(pat, rep)
  inject(FileList.new) { |res, fn| res << fn.sub(pat,rep) }
end

# Return a new FileList with the results of running +gsub+ against each
# element of the original list.
#
# Example:
#   FileList['lib/test/file', 'x/y'].gsub(/\//, "\\")
#      => ['lib\\test\\file', 'x\\y']
#
def gsub(pat, rep)
  inject(FileList.new) { |res, fn| res << fn.gsub(pat,rep) }
end

# Same as +sub+ except that the oringal file list is modified.
def sub!(pat, rep)
  each_with_index { |fn, i| self[i] = fn.sub(pat,rep) }
  self
end

# Same as +gsub+ except that the original file list is modified.
def gsub!(pat, rep)
  each_with_index { |fn, i| self[i] = fn.gsub(pat,rep) }
  self
end
 
# Apply the pathmap spec to each of the included file names, returning a
# new file list with the modified paths.  (See String#pathmap for
# details.)
def pathmap(spec=nil)
  collect { |fn| fn.pathmap(spec) }
end

// Return a new FileList with <tt>String#ext</tt> method applied
// to each member of the array.
//
// This method is a shortcut for:
//
//    array.collect { |item| item.ext(newext) }
//
// +ext+ is a user added method for the Array class.
def ext(newext='')
  collect { |fn| fn.ext(newext) }
end
 
# Grep each of the files in the filelist using the given pattern. If a
# block is given, call the block on each matching line, passing the file
# name, line number, and the matching line of text.  If no block is given,
# a standard emac style file:linenumber:line message will be printed to
# standard out.
def egrep(pattern, *options)
  each do |fn|
    open(fn, "rb", *options) do |inf|
      count = 0
      inf.each do |line|
        count += 1
        if pattern.match(line)
          if block_given?
            yield fn, count, line
          else
            puts "#{fn}:#{count}:#{line}"
          end
        end
      end
    end
  end
end
*/
// Return a new file list that only contains file names from the current
// file list that exist on the file system.
FileList.prototype.existing = function(/*String*/ aFilename)
{
    return (new FileList())._import(this.items().filter(function(aFilename)
    {
        return FILE.exists(aFilename);
    }, this));
}

// Modify the current file list so that it contains only file name that
// exist on the file system.
FileList.prototype.keepExisting = function()
{
    this._items = this.filter(function(aFilename)
    {
        return FILE.exists(aFilename);
    }, this);

    return this;
}
/*
    # FileList version of partition.  Needed because the nested arrays should
    # be FileLists in this version.
    def partition(&block)       # :nodoc:
      resolve
      result = @items.partition(&block)
      [
        FileList.new.import(result[0]),
        FileList.new.import(result[1]),
      ]
    end
*/
// Convert a FileList to a string by joining all elements with a space.
FileList.prototype.toString = function()
{
    return this.items().join(' ');
}

// Add matching glob patterns.
FileList.prototype._addMatching = function(/*String*/ aPattern)
{
    FILE.glob(aPattern).forEach(function(fileName){
        this._items.push(fileName);
    }, this);

/*      Dir[pattern].each do |fn|
        self << fn unless exclude?(fn)
      end*/
}
/*
    # Should the given file name be excluded?
    def exclude?(fn)
      return true if @exclude_patterns.any? do |pat|
        case pat
        when Regexp
          fn =~ pat
        when /[*?]/
          File.fnmatch?(pat, fn, File::FNM_PATHNAME)
        else
          fn == pat
        end
      end
      @exclude_procs.any? { |p| p.call(fn) }
    end
*/

FileList.prototype._import = function(/*Array*/ anArray)
{
    this._items = anArray.slice();
    return this;
}

exports.FileList = FileList;

/*
module Rake
  class << self
 
    # Yield each file or directory component.
    def each_dir_parent(dir)    # :nodoc:
      old_length = nil
      while dir != '.' && dir.length != old_length
        yield(dir)
        old_length = dir.length
        dir = File.dirname(dir)
      end
    end
  end
end # module Rake
*/
