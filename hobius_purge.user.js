// ==UserScript==
// @name           Hobius Purge
// @namespace      hobius_purge
// @include        http://www.hobius.com/*
// ==/UserScript==

var tracking_time = 10000;
var tracking_interval = 1000;
var debug_mode = true;


var purged_nicknames = {
    global: new Array(),
    interests: new Array(),
    subjects: {}
}

var purged_subjects = new Array();

var posts_tracker = {
    time_since_last_update: 0,
    post_ids: [],
    loop_handle: null,
    start: function () {
        debug('posts tracking started');
        this.time_since_last_update = 0;
        this.post_ids = get_posts();
        
        my_subjects = get_subjects();
        if (!this.loop_handle) {
            this.loop_handle = setInterval(function () { posts_tracker.track() }, tracking_interval);
        }
    },
    track: function () {
        debug(this);
        if (this.posts_changed()) {
            debug('posts change detected. purging');
            this.time_since_last_update = 0;
            purge_posts(this.post_ids);
        } else 
            this.time_since_last_update += tracking_interval;
        if (this.time_since_last_update >= tracking_time) {
            clearInterval(this.loop_handle);
            this.loop_handle = null;
            debug('posts tracking stopped');
        }
    },
    posts_changed: function () {
        var before = this.post_ids;
        var after = get_posts();
        if (before.length != after.length) {
            this.post_ids = after;
            return true;
        }
        for (var post_before in before) {
            var found = false;
            for (var post_after in after) {
                if (before[post_before] == after[post_after]) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                this.post_ids = after;
                return true;
            }
        }
        return false;
    }
}

var page = {
    get_subject: function () {
        return $('thing-title').innerHTML;
    },
    get_nickname: function () {
        return $('nickname').innerHTML;
    }
}

function get_posts() {
    var posts = new Array();
    var entries_container = $('entries');
    if (entries_container)
        for (i = 0; i < entries_container.childNodes.length; i++) {
            posts.push(entries_container.childNodes[i].id);
        }
    return posts;
}

function get_subjects() {
    var result = new Array();
    var subjects_container = $('things-list-group');
    if (subjects_container) {
        var inputs = subjects_container.getElementsByTagName('INPUT');        
        for (var i in inputs) {
            if (inputs[i].value)
                result.push(inputs[i].value);
        }
        save('hobius_purge/my_subjects', result);
    } else if (unsafeWindow.localStorage.getItem('hobius_purge/my_subjects'))
        result = load('hobius_purge/my_subjects');
    return result;
}

function purge_posts(posts) {
    for (var i in posts) {
        var post_id = posts[i];
        var header = $C($(post_id), 'entry-header');
        var title_container = $C(header, 'title');
        var nickname, subject;
        for (var i = 0; i < title_container.childNodes.length; i++) {
            var node = title_container.childNodes[i];
            if (node.tagName == 'A') {
                switch (node.className) {
                    case 'nickname':
                        nickname = node.childNodes[0].nodeValue;break;
                    case 'thing':
                        subject = node.childNodes[0].nodeValue;break;
                }
            }
        }
        
        if (purged_nicknames.search(nickname, 'global') ||
            (purged_nicknames.search(nickname, 'interests') && array_search(subject, my_subjects) !== false) || 
            purged_nicknames.search(nickname, 'subjects') == subject ||
            purged_subjects.length && array_search(subject, purged_subjects) !== false )
            purge_post(post_id);        
    }
}

function purge_post(post_id) {
    var post_body = $C($(post_id), 'entry-body');
    post_body.style.display = 'none';
    var unhide_link = document.createElement('a');
    unhide_link.style.display = 'block';
    unhide_link.style.textAlign = 'center';
    unhide_link.style.color = '#808080';
    unhide_link.style.backgroundColor = '#ebebeb';
    unhide_link.style.padding = '0.25em';
    unhide_link.style.cursor = 'pointer';
    unhide_link.innerHTML = 'show purged post';
    unhide_link.addEventListener('click', function (e) { 
        var post_body = $C($(post_id), 'entry-body');
        post_body.style.display = '';
        e.currentTarget.style.display = 'none';
    }, false);
    document.getElementById(post_id).appendChild(unhide_link);
}

function display_user_controls(nickname) {
    var block = document.createElement('DIV');
    block.style.cssFloat = 'left';
    block.style.width = '240px';
    block.style.color = '#808080';
    block.innerHTML = '<form id="hobius_purge_settings"><fieldset><legend>Purge settings</legend>'+
    '<div><label><input type="radio" name="mode" value="off" id="hobius_purge_setting_off"/> off<label></div>'+
    '<div><label><input type="radio" name="mode" value="global" id="hobius_purge_setting_global" /> global<label></div>'+
    '<div><label><input type="radio" name="mode" value="interests" id="hobius_purge_setting_interests" /> my interests<label></div>'+
    '<div><label><input type="radio" name="mode" value="subject"  id="hobius_purge_setting_subject" /> in <label><select name="subject" id="hobius_purge_subject_select"><option value=""></option></select></div></fieldset></form>';
    var body = $C(document.body, 'body');
    var aside = $C(body, 'aside');
    aside.appendChild(block);
    var select = $('hobius_purge_subject_select');
    for (var i in my_subjects) {
        var option = document.createElement('OPTION');
        option.text = option.value = my_subjects[i];
        select.appendChild(option);
    }
    // attach event handlers
    var inputs = $('hobius_purge_settings').getElementsByTagName('INPUT');
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('change', function () {save_user_settings()}, false);
    }
    select.addEventListener('change', function () {save_user_settings()}, false);
    // current setting
    if (purged_nicknames.search(nickname, 'global'))
        $('hobius_purge_setting_global').checked = true;
    else if (purged_nicknames.search(nickname, 'interests'))
        $('hobius_purge_setting_interests').checked = true;
    else if (purged_nicknames.search(nickname, 'subjects')) {
        $('hobius_purge_setting_subject').checked = true;
        var purging_subject = purged_nicknames.search(nickname, 'subjects');
        for (var i = 0; i < select.options.length; i++)
            if (select.options[i].value == purging_subject)
                select.options[i].selected = true;
    } else
        $('hobius_purge_setting_off').checked = true;
}

function display_subject_controls(subject) {
    var purged = (array_search(subject, purged_subjects) !== false);
    var block = document.createElement('DIV');
    block.style.cssFloat = 'left';
    block.style.width = '240px';
    block.style.color = '#808080';
    block.innerHTML = '<form id="hobius_purge_settings"><fieldset><legend>Purge settings</legend>'+
    '<div><label><input type="radio" name="mode" value="off"' + (purged ? '' : ' checked="checked"') + ' /> off<label></div>'+
    '<div><label><input type="radio" name="mode" value="on"' + (purged ? ' checked="checked"' : '') + ' /> on<label></div></fieldset></form>';
    var body = $C(document.body, 'body');
    var aside = $C(body, 'aside');
    aside.appendChild(block);
    var inputs = $('hobius_purge_settings').getElementsByTagName('INPUT');
    for (var i = 0; i < inputs.length; i++) {
        inputs[i].addEventListener('change', function () {save_subject_settings()}, false);
    }
}

function save_user_settings() {
    var nickname = page.get_nickname();
    var inputs = $('hobius_purge_settings').getElementsByTagName('INPUT');
    for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].checked) {
            debug('setting value: ' + inputs[i].value);
            switch (inputs[i].value) {
                case 'off':
                    remove_from_purged_nicknames(nickname);
                    break;
                case 'global':
                    remove_from_purged_nicknames(nickname);
                    purged_nicknames.global.push(nickname);
                    break;
                case 'interests':
                    remove_from_purged_nicknames(nickname);
                    purged_nicknames.interests.push(nickname);
                    break;
                case 'subject':
                    remove_from_purged_nicknames(nickname);
                    var subject = $('hobius_purge_subject_select').value;
                    if (subject) {
                        if (!purged_nicknames.subjects[subject])
                            purged_nicknames.subjects[subject] = new Array();
                            purged_nicknames.subjects[subject].push(nickname);
                    }
                    break;
            }
            save('hobius_purge/purged_nicknames', purged_nicknames);
            dump_purged_nicknames();
            return;
        }
    }
}

function save_subject_settings() {
    var subject = page.get_subject();
    debug('subject: ' + subject);
    var inputs = $('hobius_purge_settings').getElementsByTagName('INPUT');
    for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].checked) {
            debug('setting value: ' + inputs[i].value);
            switch (inputs[i].value) {
                case 'off':
                    remove_from_purged_subjects(subject);
                    break;
                case 'on':
                    remove_from_purged_subjects(subject);
                    purged_subjects.push(subject);
                    break;
            }
            save('hobius_purge/purged_subjects', purged_subjects);
            debug('purged subjects: ' + purged_subjects);
            return;
        }
    }
}

function remove_from_purged_nicknames(nickname) {
    purged_nicknames.global = array_remove(nickname, purged_nicknames.global);
    purged_nicknames.interests = array_remove(nickname, purged_nicknames.interests);
    for (var subject in purged_nicknames.subjects) {
        purged_nicknames.subjects[subject] = array_remove(nickname, purged_nicknames.subjects[subject]);
    }
}

function remove_from_purged_subjects(subject) {
    purged_subjects = array_remove(subject, purged_subjects);
}

function $(element_id) {
    return document.getElementById(element_id);
}

function $C(element, class_name) {
    return child_search(element, function (el) { return el.className == class_name} );
}

function array_search(needle, haystack) {
    for (var i in haystack) {
        if (needle == haystack[i])
            return i;
    }
    return false;
}

function array_remove(needle, haystack) {
    var result = new Array();
    for (var i in haystack) {
        if (needle != haystack[i])
            result.push(haystack[i]);
    }
    return result;
}

function child_search(element, detector) {
    for (var i = 0; i < element.childNodes.length; i++) {
        if (detector(element.childNodes[i]))
            return element.childNodes[i];
    }
    return false;
}

function save(name, value) {
    unsafeWindow.localStorage.setItem(name, JSON.stringify(value));
}

function load(name) {
    return JSON.parse(unsafeWindow.localStorage.getItem(name));
}

function debug(message) {
    if (debug_mode)
        unsafeWindow.console.info(message);
}

function dump_purged_nicknames() {
    debug('purged globally: ' + purged_nicknames.global);
    debug('purged in my interests: ' + purged_nicknames.interests);
    for (var subject in purged_nicknames.subjects)
        debug('purged in ['+subject+']: ' + purged_nicknames.subjects[subject]);
}


// START

if (unsafeWindow.localStorage.getItem('hobius_purge/purged_nicknames'))
    purged_nicknames = load('hobius_purge/purged_nicknames');
else
    save('hobius_purge/purged_nicknames', purged_nicknames);
    
purged_nicknames.search = function (nickname, set) {
    if (set == 'subjects') {
        for (var subject in this.subjects) {
            if (this.subjects[subject].length && array_search(nickname, this.subjects[subject]) !== false)
                return subject;
        }
        return false;
    } else {
        if (this[set] && this[set].length)
            return array_search(nickname, this[set]) !== false;
    }
}
    
if (unsafeWindow.localStorage.getItem('hobius_purge/purged_subjects'))
    purged_subjects = load('hobius_purge/purged_subjects');
else
    save('hobius_purge/purged_subjects', purged_subjects);


dump_purged_nicknames();
debug('purged subjects: ' + purged_subjects);

var my_subjects = [];

unsafeWindow.addEventListener('hashchange', function(event) { posts_tracker.start() }, false);

debug('event listener set');

$('entries-more').addEventListener('click', function(event) { posts_tracker.start() }, false)

posts_tracker.start() 

debug('post tracking started');

if (window.location.href.substr(0, 28) == 'http://www.hobius.com/?user=') {
    debug('rendering user controls');
    display_user_controls(page.get_nickname());
} else if (window.location.href.substr(0, 31) == 'http://www.hobius.com/?subject=') {
    debug('rendering subject controls');
    display_subject_controls(page.get_subject());
}

debug('all done');