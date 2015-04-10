/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/*jshint esnext: true */
/*jshint indent: 4 */

/*
 * Taken from Michele's Dash to Dock extension
 * https://github.com/micheleg/dash-to-dock
 *
 * Part of this file comes from gnome-shell-extensions:
 * http://git.gnome.org/browse/gnome-shell-extensions/
 *
 */

const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Lang = imports.lang;

const Config = imports.misc.config;
const ExtensionUtils = imports.misc.extensionUtils;

/**
 * initTranslations:
 * @domain: (optional): the gettext domain to use
 *
 * Initialize Gettext to load translations from extensionsdir/locale.
 * If @domain is not provided, it will be taken from metadata['gettext-domain']
 */
function initTranslations(domain) {

    let extension = ExtensionUtils.getCurrentExtension();

    domain = domain || extension.metadata['gettext-domain'];

    // check if this extension was built with "make zip-file", and thus
    // has the locale files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell
    let localeDir = extension.dir.get_child('locale');
    if (localeDir.query_exists(null)) {
        Gettext.bindtextdomain(domain, localeDir.get_path());
    } else {
        Gettext.bindtextdomain(domain, Config.LOCALEDIR);
    }
}

/**
 * getSettings:
 * @schema: (optional): the GSettings schema id
 *
 * Builds and return a GSettings schema for @schema, using schema files
 * in extensionsdir/schemas. If @schema is not provided, it is taken from
 * metadata['settings-schema'].
 */
function getSettings(schema) {

    let extension = ExtensionUtils.getCurrentExtension();

    schema = schema || extension.metadata['settings-schema'];

    const GioSSS = Gio.SettingsSchemaSource;

    // check if this extension was built with "make zip-file", and thus
    // has the schema files in a subfolder
    // otherwise assume that extension has been installed in the
    // same prefix as gnome-shell (and therefore schemas are available
    // in the standard folders)
    let schemaDir = extension.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = GioSSS.new_from_directory(schemaDir.get_path(),
                                                 GioSSS.get_default(),
                                                 false);
    } else {
        schemaSource = GioSSS.get_default();
    }

    let schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        throw new Error('Schema ' + schema + ' could not be found for extension ' +
            extension.metadata.uuid + '. Please check your installation.');
    }

    return new Gio.Settings({ settings_schema: schemaObj });
}

// try to simplify global signals handling
const GlobalSignalHandler = new Lang.Class({
    Name: 'AtomDock.GlobalSignalHandler',

    _init: function(){
        this._signals = {};
    },

    push: function(/*unlimited 3-long array arguments*/){
        this._addSignals('generic', arguments);
    },

    disconnect: function() {
        for (let label in this._signals) {
            this.disconnectWithLabel(label);
        }
    },

    pushWithLabel: function(label /* plus unlimited 3-long array arguments*/) {
        // skip first element of thearguments array;
        let elements = [];
        for (let i = 1 ; i< arguments.length; i++) {
            elements.push(arguments[i]);
        }

        this._addSignals(label, elements);
    },

    _addSignals: function(label, elements) {

        if (this._signals[label] === undefined) {
            this._signals[label] = [];
        }

        for (let i = 0; i < elements.length; i++) {

            let object = elements[i][0];
            let event = elements[i][1];

            let id = object.connect(event, elements[i][2]);
            this._signals[label].push( [ object , id ] );
        }
    },

    disconnectWithLabel: function(label) {

        if (this._signals[label]) {
            for (let i = 0; i < this._signals[label].length; i++) {
                this._signals[label][i][0].disconnect(this._signals[label][i][1]);
            }

            delete this._signals[label];
        }
    }

});

// Function injection
const FunctionInjector = new Lang.Class({
    Name: 'AtomDock.FunctionInjector',

    _init: function(){
        this._injections = {};
    },

    push: function(/*unlimited 3-long array arguments*/){
        this._inject('generic', arguments);
    },

    destroy: function() {
        for (let label in this._injections) {
            this.deinjectWithLabel(label);
        }
    },

    pushWithLabel: function(label /* plus unlimited 3-long array arguments*/) {
        // skip first element of thearguments array;
        let elements = [];
        for (let i = 1 ; i < arguments.length; i++) {
            elements.push(arguments[i]);
        }

        this._inject(label, elements);
    },

    _inject: function(label, elements) {

        if (this._injections[label] === undefined) {
            this._injections[label] = [];
        }

        for (let i = 0; i < elements.length; i++) {

            let parent = elements[i][0];
            let name = elements[i][1];
            let func = elements[i][2];

            let origin = parent[name];
            parent[name] = function() {
                let ret;
                ret = origin.apply(this, arguments);
                if (ret === undefined) {
                    ret = func.apply(this, arguments);
                }

                return ret;
            };

            this._injections[label].push( [ parent, name, origin ] );
        }
    },

    deinjectWithLabel: function(label) {

        if (this._injections[label]) {
            for (let i = 0; i < this._injections[label].length; i++) {
                let parent = this._injections[label][i][0];
                let name = this._injections[label][i][1];
                let originalFunc = this._injections[label][i][2];

                if (originalFunc === undefined) {
                    delete parent[name];
                } else {
                    parent[name] = originalFunc;
                }
            }

            delete this._injections[label];
        }
    }

});
