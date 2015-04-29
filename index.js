var sm = new (require('sphericalmercator'))();
var fs = require('fs');
var mbgl = require('mapbox-gl-native');

module.exports = function(fileSource) {
    if (!(fileSource instanceof mbgl.FileSource)) throw new Error('fileSource must be a FileSource object');
    if (typeof fileSource.request !== 'function') throw new Error("fileSource must have a 'request' method");
    if (typeof fileSource.cancel !== 'function') throw new Error("fileSource must have a 'cancel' method");

    GL.prototype._fileSource = fileSource;

    return GL;
};

module.exports.mbgl = mbgl;

function GL(options, callback) {
    if ((typeof options !== 'object' && typeof options !== 'string') || !options) return callback(new Error('options must be an object or a string'));

    this._map = new mbgl.Map(this._fileSource);

    if (options.protocol && options.protocol === 'gl:') {
        style = JSON.parse(fs.readFileSync(options.path));
    } else if (typeof options.style === 'object') {
        style = options.style;
    } else {
        return callback(new Error('options.style must be a GL style object'));
    }

    this._map.load(style);

    return callback(null, this);
}

GL.registerProtocols = function(tilelive) {
    tilelive.protocols['gl:'] = GL;
};

GL.prototype.getTile = function(z, x, y, callback) {

    // Hack around tilelive API - allow params to be passed per request
    // as attributes of the callback function.
    var scale = callback.scale || 1;

    var bbox = sm.bbox(+x,+y,+z, false, '900913');
    var center = sm.inverse([bbox[0] + ((bbox[2] - bbox[0]) * 0.5), bbox[1] + ((bbox[3] - bbox[1]) * 0.5)]);

    var options = {
        // pass center in lat, lng order
        center: [center[1], center[0]],
        width: 512,
        height: 512,
        ratio: scale,
        zoom: z
    };

    if (typeof callback.accessToken !== 'string') return callback(new Error('callback.accessToken must be a string'));
    this._map.setAccessToken(callback.accessToken);

    this._map.render(options, function(err, buffer) {
        if (err) return callback(err);

        mbgl.compressPNG(buffer, function(err, image) {
            if (err) return callback(err);
            return callback(null, image, { 'Content-Type': 'image/png' });
        });
    });
};
