/*! Copyright (c) 2025 HP Development Company, L.P. */
/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 483:
/***/ (function(module) {

(function (root) {
    'use strict';
    // A list of regular expressions that match arbitrary IPv4 addresses,
    // for which a number of weird notations exist.
    // Note that an address like 0010.0xa5.1.1 is considered legal.
    const ipv4Part = '(0?\\d+|0x[a-f0-9]+)';
    const ipv4Regexes = {
        fourOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, 'i'),
        threeOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}$`, 'i'),
        twoOctet: new RegExp(`^${ipv4Part}\\.${ipv4Part}$`, 'i'),
        longValue: new RegExp(`^${ipv4Part}$`, 'i')
    };

    // Regular Expression for checking Octal numbers
    const octalRegex = new RegExp(`^0[0-7]+$`, 'i');
    const hexRegex = new RegExp(`^0x[a-f0-9]+$`, 'i');

    const zoneIndex = '%[0-9a-z]{1,}';

    // IPv6-matching regular expressions.
    // For IPv6, the task is simpler: it is enough to match the colon-delimited
    // hexadecimal IPv6 and a transitional variant with dotted-decimal IPv4 at
    // the end.
    const ipv6Part = '(?:[0-9a-f]+::?)+';
    const ipv6Regexes = {
        zoneIndex: new RegExp(zoneIndex, 'i'),
        'native': new RegExp(`^(::)?(${ipv6Part})?([0-9a-f]+)?(::)?(${zoneIndex})?$`, 'i'),
        deprecatedTransitional: new RegExp(`^(?:::)(${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?)$`, 'i'),
        transitional: new RegExp(`^((?:${ipv6Part})|(?:::)(?:${ipv6Part})?)${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}\\.${ipv4Part}(${zoneIndex})?$`, 'i')
    };

    // Expand :: in an IPv6 address or address part consisting of `parts` groups.
    function expandIPv6 (string, parts) {
        // More than one '::' means invalid adddress
        if (string.indexOf('::') !== string.lastIndexOf('::')) {
            return null;
        }

        let colonCount = 0;
        let lastColon = -1;
        let zoneId = (string.match(ipv6Regexes.zoneIndex) || [])[0];
        let replacement, replacementCount;

        // Remove zone index and save it for later
        if (zoneId) {
            zoneId = zoneId.substring(1);
            string = string.replace(/%.+$/, '');
        }

        // How many parts do we already have?
        while ((lastColon = string.indexOf(':', lastColon + 1)) >= 0) {
            colonCount++;
        }

        // 0::0 is two parts more than ::
        if (string.substr(0, 2) === '::') {
            colonCount--;
        }

        if (string.substr(-2, 2) === '::') {
            colonCount--;
        }

        // The following loop would hang if colonCount > parts
        if (colonCount > parts) {
            return null;
        }

        // replacement = ':' + '0:' * (parts - colonCount)
        replacementCount = parts - colonCount;
        replacement = ':';
        while (replacementCount--) {
            replacement += '0:';
        }

        // Insert the missing zeroes
        string = string.replace('::', replacement);

        // Trim any garbage which may be hanging around if :: was at the edge in
        // the source strin
        if (string[0] === ':') {
            string = string.slice(1);
        }

        if (string[string.length - 1] === ':') {
            string = string.slice(0, -1);
        }

        parts = (function () {
            const ref = string.split(':');
            const results = [];

            for (let i = 0; i < ref.length; i++) {
                results.push(parseInt(ref[i], 16));
            }

            return results;
        })();

        return {
            parts: parts,
            zoneId: zoneId
        };
    }

    // A generic CIDR (Classless Inter-Domain Routing) RFC1518 range matcher.
    function matchCIDR (first, second, partSize, cidrBits) {
        if (first.length !== second.length) {
            throw new Error('ipaddr: cannot match CIDR for objects with different lengths');
        }

        let part = 0;
        let shift;

        while (cidrBits > 0) {
            shift = partSize - cidrBits;
            if (shift < 0) {
                shift = 0;
            }

            if (first[part] >> shift !== second[part] >> shift) {
                return false;
            }

            cidrBits -= partSize;
            part += 1;
        }

        return true;
    }

    function parseIntAuto (string) {
        // Hexadedimal base 16 (0x#)
        if (hexRegex.test(string)) {
            return parseInt(string, 16);
        }
        // While octal representation is discouraged by ECMAScript 3
        // and forbidden by ECMAScript 5, we silently allow it to
        // work only if the rest of the string has numbers less than 8.
        if (string[0] === '0' && !isNaN(parseInt(string[1], 10))) {
        if (octalRegex.test(string)) {
            return parseInt(string, 8);
        }
            throw new Error(`ipaddr: cannot parse ${string} as octal`);
        }
        // Always include the base 10 radix!
        return parseInt(string, 10);
    }

    function padPart (part, length) {
        while (part.length < length) {
            part = `0${part}`;
        }

        return part;
    }

    const ipaddr = {};

    // An IPv4 address (RFC791).
    ipaddr.IPv4 = (function () {
        // Constructs a new IPv4 address from an array of four octets
        // in network order (MSB first)
        // Verifies the input.
        function IPv4 (octets) {
            if (octets.length !== 4) {
                throw new Error('ipaddr: ipv4 octet count should be 4');
            }

            let i, octet;

            for (i = 0; i < octets.length; i++) {
                octet = octets[i];
                if (!((0 <= octet && octet <= 255))) {
                    throw new Error('ipaddr: ipv4 octet should fit in 8 bits');
                }
            }

            this.octets = octets;
        }

        // Special IPv4 address ranges.
        // See also https://en.wikipedia.org/wiki/Reserved_IP_addresses
        IPv4.prototype.SpecialRanges = {
            unspecified: [[new IPv4([0, 0, 0, 0]), 8]],
            broadcast: [[new IPv4([255, 255, 255, 255]), 32]],
            // RFC3171
            multicast: [[new IPv4([224, 0, 0, 0]), 4]],
            // RFC3927
            linkLocal: [[new IPv4([169, 254, 0, 0]), 16]],
            // RFC5735
            loopback: [[new IPv4([127, 0, 0, 0]), 8]],
            // RFC6598
            carrierGradeNat: [[new IPv4([100, 64, 0, 0]), 10]],
            // RFC1918
            'private': [
                [new IPv4([10, 0, 0, 0]), 8],
                [new IPv4([172, 16, 0, 0]), 12],
                [new IPv4([192, 168, 0, 0]), 16]
            ],
            // Reserved and testing-only ranges; RFCs 5735, 5737, 2544, 1700
            reserved: [
                [new IPv4([192, 0, 0, 0]), 24],
                [new IPv4([192, 0, 2, 0]), 24],
                [new IPv4([192, 88, 99, 0]), 24],
                [new IPv4([198, 51, 100, 0]), 24],
                [new IPv4([203, 0, 113, 0]), 24],
                [new IPv4([240, 0, 0, 0]), 4]
            ]
        };

        // The 'kind' method exists on both IPv4 and IPv6 classes.
        IPv4.prototype.kind = function () {
            return 'ipv4';
        };

        // Checks if this address matches other one within given CIDR range.
        IPv4.prototype.match = function (other, cidrRange) {
            let ref;
            if (cidrRange === undefined) {
                ref = other;
                other = ref[0];
                cidrRange = ref[1];
            }

            if (other.kind() !== 'ipv4') {
                throw new Error('ipaddr: cannot match ipv4 address with non-ipv4 one');
            }

            return matchCIDR(this.octets, other.octets, 8, cidrRange);
        };

        // returns a number of leading ones in IPv4 address, making sure that
        // the rest is a solid sequence of 0's (valid netmask)
        // returns either the CIDR length or null if mask is not valid
        IPv4.prototype.prefixLengthFromSubnetMask = function () {
            let cidr = 0;
            // non-zero encountered stop scanning for zeroes
            let stop = false;
            // number of zeroes in octet
            const zerotable = {
                0: 8,
                128: 7,
                192: 6,
                224: 5,
                240: 4,
                248: 3,
                252: 2,
                254: 1,
                255: 0
            };
            let i, octet, zeros;

            for (i = 3; i >= 0; i -= 1) {
                octet = this.octets[i];
                if (octet in zerotable) {
                    zeros = zerotable[octet];
                    if (stop && zeros !== 0) {
                        return null;
                    }

                    if (zeros !== 8) {
                        stop = true;
                    }

                    cidr += zeros;
                } else {
                    return null;
                }
            }

            return 32 - cidr;
        };

        // Checks if the address corresponds to one of the special ranges.
        IPv4.prototype.range = function () {
            return ipaddr.subnetMatch(this, this.SpecialRanges);
        };

        // Returns an array of byte-sized values in network order (MSB first)
        IPv4.prototype.toByteArray = function () {
            return this.octets.slice(0);
        };

        // Converts this IPv4 address to an IPv4-mapped IPv6 address.
        IPv4.prototype.toIPv4MappedAddress = function () {
            return ipaddr.IPv6.parse(`::ffff:${this.toString()}`);
        };

        // Symmetrical method strictly for aligning with the IPv6 methods.
        IPv4.prototype.toNormalizedString = function () {
            return this.toString();
        };

        // Returns the address in convenient, decimal-dotted format.
        IPv4.prototype.toString = function () {
            return this.octets.join('.');
        };

        return IPv4;
    })();

    // A utility function to return broadcast address given the IPv4 interface and prefix length in CIDR notation
    ipaddr.IPv4.broadcastAddressFromCIDR = function (string) {

        try {
            const cidr = this.parseCIDR(string);
            const ipInterfaceOctets = cidr[0].toByteArray();
            const subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
            const octets = [];
            let i = 0;
            while (i < 4) {
                // Broadcast address is bitwise OR between ip interface and inverted mask
                octets.push(parseInt(ipInterfaceOctets[i], 10) | parseInt(subnetMaskOctets[i], 10) ^ 255);
                i++;
            }

            return new this(octets);
        } catch (e) {
            throw new Error('ipaddr: the address does not have IPv4 CIDR format');
        }
    };

    // Checks if a given string is formatted like IPv4 address.
    ipaddr.IPv4.isIPv4 = function (string) {
        return this.parser(string) !== null;
    };

    // Checks if a given string is a valid IPv4 address.
    ipaddr.IPv4.isValid = function (string) {
        try {
            new this(this.parser(string));
            return true;
        } catch (e) {
            return false;
        }
    };

    // Checks if a given string is a full four-part IPv4 Address.
    ipaddr.IPv4.isValidFourPartDecimal = function (string) {
        if (ipaddr.IPv4.isValid(string) && string.match(/^(0|[1-9]\d*)(\.(0|[1-9]\d*)){3}$/)) {
            return true;
        } else {
            return false;
        }
    };

    // A utility function to return network address given the IPv4 interface and prefix length in CIDR notation
    ipaddr.IPv4.networkAddressFromCIDR = function (string) {
        let cidr, i, ipInterfaceOctets, octets, subnetMaskOctets;

        try {
            cidr = this.parseCIDR(string);
            ipInterfaceOctets = cidr[0].toByteArray();
            subnetMaskOctets = this.subnetMaskFromPrefixLength(cidr[1]).toByteArray();
            octets = [];
            i = 0;
            while (i < 4) {
                // Network address is bitwise AND between ip interface and mask
                octets.push(parseInt(ipInterfaceOctets[i], 10) & parseInt(subnetMaskOctets[i], 10));
                i++;
            }

            return new this(octets);
        } catch (e) {
            throw new Error('ipaddr: the address does not have IPv4 CIDR format');
        }
    };

    // Tries to parse and validate a string with IPv4 address.
    // Throws an error if it fails.
    ipaddr.IPv4.parse = function (string) {
        const parts = this.parser(string);

        if (parts === null) {
            throw new Error('ipaddr: string is not formatted like an IPv4 Address');
        }

        return new this(parts);
    };

    // Parses the string as an IPv4 Address with CIDR Notation.
    ipaddr.IPv4.parseCIDR = function (string) {
        let match;

        if ((match = string.match(/^(.+)\/(\d+)$/))) {
            const maskLength = parseInt(match[2]);
            if (maskLength >= 0 && maskLength <= 32) {
                const parsed = [this.parse(match[1]), maskLength];
                Object.defineProperty(parsed, 'toString', {
                    value: function () {
                        return this.join('/');
                    }
                });
                return parsed;
            }
        }

        throw new Error('ipaddr: string is not formatted like an IPv4 CIDR range');
    };

    // Classful variants (like a.b, where a is an octet, and b is a 24-bit
    // value representing last three octets; this corresponds to a class C
    // address) are omitted due to classless nature of modern Internet.
    ipaddr.IPv4.parser = function (string) {
        let match, part, value;

        // parseInt recognizes all that octal & hexadecimal weirdness for us
        if ((match = string.match(ipv4Regexes.fourOctet))) {
            return (function () {
                const ref = match.slice(1, 6);
                const results = [];

                for (let i = 0; i < ref.length; i++) {
                    part = ref[i];
                    results.push(parseIntAuto(part));
                }

                return results;
            })();
        } else if ((match = string.match(ipv4Regexes.longValue))) {
            value = parseIntAuto(match[1]);
            if (value > 0xffffffff || value < 0) {
                throw new Error('ipaddr: address outside defined range');
            }

            return ((function () {
                const results = [];
                let shift;

                for (shift = 0; shift <= 24; shift += 8) {
                    results.push((value >> shift) & 0xff);
                }

                return results;
            })()).reverse();
        } else if ((match = string.match(ipv4Regexes.twoOctet))) {
            return (function () {
                const ref = match.slice(1, 4);
                const results = [];

                value = parseIntAuto(ref[1]);
                if (value > 0xffffff || value < 0) {
                    throw new Error('ipaddr: address outside defined range');
                }

                results.push(parseIntAuto(ref[0]));
                results.push((value >> 16) & 0xff);
                results.push((value >>  8) & 0xff);
                results.push( value        & 0xff);

                return results;
            })();
        } else if ((match = string.match(ipv4Regexes.threeOctet))) {
            return (function () {
                const ref = match.slice(1, 5);
                const results = [];

                value = parseIntAuto(ref[2]);
                if (value > 0xffff || value < 0) {
                    throw new Error('ipaddr: address outside defined range');
                }

                results.push(parseIntAuto(ref[0]));
                results.push(parseIntAuto(ref[1]));
                results.push((value >> 8) & 0xff);
                results.push( value       & 0xff);

                return results;
            })();
        } else {
            return null;
        }
    };

    // A utility function to return subnet mask in IPv4 format given the prefix length
    ipaddr.IPv4.subnetMaskFromPrefixLength = function (prefix) {
        prefix = parseInt(prefix);
        if (prefix < 0 || prefix > 32) {
            throw new Error('ipaddr: invalid IPv4 prefix length');
        }

        const octets = [0, 0, 0, 0];
        let j = 0;
        const filledOctetCount = Math.floor(prefix / 8);

        while (j < filledOctetCount) {
            octets[j] = 255;
            j++;
        }

        if (filledOctetCount < 4) {
            octets[filledOctetCount] = Math.pow(2, prefix % 8) - 1 << 8 - (prefix % 8);
        }

        return new this(octets);
    };

    // An IPv6 address (RFC2460)
    ipaddr.IPv6 = (function () {
        // Constructs an IPv6 address from an array of eight 16 - bit parts
        // or sixteen 8 - bit parts in network order(MSB first).
        // Throws an error if the input is invalid.
        function IPv6 (parts, zoneId) {
            let i, part;

            if (parts.length === 16) {
                this.parts = [];
                for (i = 0; i <= 14; i += 2) {
                    this.parts.push((parts[i] << 8) | parts[i + 1]);
                }
            } else if (parts.length === 8) {
                this.parts = parts;
            } else {
                throw new Error('ipaddr: ipv6 part count should be 8 or 16');
            }

            for (i = 0; i < this.parts.length; i++) {
                part = this.parts[i];
                if (!((0 <= part && part <= 0xffff))) {
                    throw new Error('ipaddr: ipv6 part should fit in 16 bits');
                }
            }

            if (zoneId) {
                this.zoneId = zoneId;
            }
        }

        // Special IPv6 ranges
        IPv6.prototype.SpecialRanges = {
            // RFC4291, here and after
            unspecified: [new IPv6([0, 0, 0, 0, 0, 0, 0, 0]), 128],
            linkLocal: [new IPv6([0xfe80, 0, 0, 0, 0, 0, 0, 0]), 10],
            multicast: [new IPv6([0xff00, 0, 0, 0, 0, 0, 0, 0]), 8],
            loopback: [new IPv6([0, 0, 0, 0, 0, 0, 0, 1]), 128],
            uniqueLocal: [new IPv6([0xfc00, 0, 0, 0, 0, 0, 0, 0]), 7],
            ipv4Mapped: [new IPv6([0, 0, 0, 0, 0, 0xffff, 0, 0]), 96],
            // RFC6145
            rfc6145: [new IPv6([0, 0, 0, 0, 0xffff, 0, 0, 0]), 96],
            // RFC6052
            rfc6052: [new IPv6([0x64, 0xff9b, 0, 0, 0, 0, 0, 0]), 96],
            // RFC3056
            '6to4': [new IPv6([0x2002, 0, 0, 0, 0, 0, 0, 0]), 16],
            // RFC6052, RFC6146
            teredo: [new IPv6([0x2001, 0, 0, 0, 0, 0, 0, 0]), 32],
            // RFC4291
            reserved: [[new IPv6([0x2001, 0xdb8, 0, 0, 0, 0, 0, 0]), 32]]
        };

        // Checks if this address is an IPv4-mapped IPv6 address.
        IPv6.prototype.isIPv4MappedAddress = function () {
            return this.range() === 'ipv4Mapped';
        };

        // The 'kind' method exists on both IPv4 and IPv6 classes.
        IPv6.prototype.kind = function () {
            return 'ipv6';
        };

        // Checks if this address matches other one within given CIDR range.
        IPv6.prototype.match = function (other, cidrRange) {
            let ref;

            if (cidrRange === undefined) {
                ref = other;
                other = ref[0];
                cidrRange = ref[1];
            }

            if (other.kind() !== 'ipv6') {
                throw new Error('ipaddr: cannot match ipv6 address with non-ipv6 one');
            }

            return matchCIDR(this.parts, other.parts, 16, cidrRange);
        };

        // returns a number of leading ones in IPv6 address, making sure that
        // the rest is a solid sequence of 0's (valid netmask)
        // returns either the CIDR length or null if mask is not valid
        IPv6.prototype.prefixLengthFromSubnetMask = function () {
            let cidr = 0;
            // non-zero encountered stop scanning for zeroes
            let stop = false;
            // number of zeroes in octet
            const zerotable = {
                0: 16,
                32768: 15,
                49152: 14,
                57344: 13,
                61440: 12,
                63488: 11,
                64512: 10,
                65024: 9,
                65280: 8,
                65408: 7,
                65472: 6,
                65504: 5,
                65520: 4,
                65528: 3,
                65532: 2,
                65534: 1,
                65535: 0
            };
            let part, zeros;

            for (let i = 7; i >= 0; i -= 1) {
                part = this.parts[i];
                if (part in zerotable) {
                    zeros = zerotable[part];
                    if (stop && zeros !== 0) {
                        return null;
                    }

                    if (zeros !== 16) {
                        stop = true;
                    }

                    cidr += zeros;
                } else {
                    return null;
                }
            }

            return 128 - cidr;
        };


        // Checks if the address corresponds to one of the special ranges.
        IPv6.prototype.range = function () {
            return ipaddr.subnetMatch(this, this.SpecialRanges);
        };

        // Returns an array of byte-sized values in network order (MSB first)
        IPv6.prototype.toByteArray = function () {
            let part;
            const bytes = [];
            const ref = this.parts;
            for (let i = 0; i < ref.length; i++) {
                part = ref[i];
                bytes.push(part >> 8);
                bytes.push(part & 0xff);
            }

            return bytes;
        };

        // Returns the address in expanded format with all zeroes included, like
        // 2001:0db8:0008:0066:0000:0000:0000:0001
        IPv6.prototype.toFixedLengthString = function () {
            const addr = ((function () {
                const results = [];
                for (let i = 0; i < this.parts.length; i++) {
                    results.push(padPart(this.parts[i].toString(16), 4));
                }

                return results;
            }).call(this)).join(':');

            let suffix = '';

            if (this.zoneId) {
                suffix = `%${this.zoneId}`;
            }

            return addr + suffix;
        };

        // Converts this address to IPv4 address if it is an IPv4-mapped IPv6 address.
        // Throws an error otherwise.
        IPv6.prototype.toIPv4Address = function () {
            if (!this.isIPv4MappedAddress()) {
                throw new Error('ipaddr: trying to convert a generic ipv6 address to ipv4');
            }

            const ref = this.parts.slice(-2);
            const high = ref[0];
            const low = ref[1];

            return new ipaddr.IPv4([high >> 8, high & 0xff, low >> 8, low & 0xff]);
        };

        // Returns the address in expanded format with all zeroes included, like
        // 2001:db8:8:66:0:0:0:1
        //
        // Deprecated: use toFixedLengthString() instead.
        IPv6.prototype.toNormalizedString = function () {
            const addr = ((function () {
                const results = [];

                for (let i = 0; i < this.parts.length; i++) {
                    results.push(this.parts[i].toString(16));
                }

                return results;
            }).call(this)).join(':');

            let suffix = '';

            if (this.zoneId) {
                suffix = `%${this.zoneId}`;
            }

            return addr + suffix;
        };

        // Returns the address in compact, human-readable format like
        // 2001:db8:8:66::1
        // in line with RFC 5952 (see https://tools.ietf.org/html/rfc5952#section-4)
        IPv6.prototype.toRFC5952String = function () {
            const regex = /((^|:)(0(:|$)){2,})/g;
            const string = this.toNormalizedString();
            let bestMatchIndex = 0;
            let bestMatchLength = -1;
            let match;

            while ((match = regex.exec(string))) {
                if (match[0].length > bestMatchLength) {
                    bestMatchIndex = match.index;
                    bestMatchLength = match[0].length;
                }
            }

            if (bestMatchLength < 0) {
                return string;
            }

            return `${string.substring(0, bestMatchIndex)}::${string.substring(bestMatchIndex + bestMatchLength)}`;
        };

        // Returns the address in compact, human-readable format like
        // 2001:db8:8:66::1
        //
        // Deprecated: use toRFC5952String() instead.
        IPv6.prototype.toString = function () {
            // Replace the first sequence of 1 or more '0' parts with '::'
            return this.toNormalizedString().replace(/((^|:)(0(:|$))+)/, '::');
        };

        return IPv6;

    })();

    // Checks if a given string is formatted like IPv6 address.
    ipaddr.IPv6.isIPv6 = function (string) {
        return this.parser(string) !== null;
    };

    // Checks to see if string is a valid IPv6 Address
    ipaddr.IPv6.isValid = function (string) {

        // Since IPv6.isValid is always called first, this shortcut
        // provides a substantial performance gain.
        if (typeof string === 'string' && string.indexOf(':') === -1) {
            return false;
        }

        try {
            const addr = this.parser(string);
            new this(addr.parts, addr.zoneId);
            return true;
        } catch (e) {
            return false;
        }
    };

    // Tries to parse and validate a string with IPv6 address.
    // Throws an error if it fails.
    ipaddr.IPv6.parse = function (string) {
        const addr = this.parser(string);

        if (addr.parts === null) {
            throw new Error('ipaddr: string is not formatted like an IPv6 Address');
        }

        return new this(addr.parts, addr.zoneId);
    };

    ipaddr.IPv6.parseCIDR = function (string) {
        let maskLength, match, parsed;

        if ((match = string.match(/^(.+)\/(\d+)$/))) {
            maskLength = parseInt(match[2]);
            if (maskLength >= 0 && maskLength <= 128) {
                parsed = [this.parse(match[1]), maskLength];
                Object.defineProperty(parsed, 'toString', {
                    value: function () {
                        return this.join('/');
                    }
                });
                return parsed;
            }
        }

        throw new Error('ipaddr: string is not formatted like an IPv6 CIDR range');
    };

    // Parse an IPv6 address.
    ipaddr.IPv6.parser = function (string) {
        let addr, i, match, octet, octets, zoneId;

        if ((match = string.match(ipv6Regexes.deprecatedTransitional))) {
            return this.parser(`::ffff:${match[1]}`);
        }
        if (ipv6Regexes.native.test(string)) {
            return expandIPv6(string, 8);
        }
        if ((match = string.match(ipv6Regexes.transitional))) {
            zoneId = match[6] || '';
            addr = expandIPv6(match[1].slice(0, -1) + zoneId, 6);
            if (addr.parts) {
                octets = [
                    parseInt(match[2]),
                    parseInt(match[3]),
                    parseInt(match[4]),
                    parseInt(match[5])
                ];
                for (i = 0; i < octets.length; i++) {
                    octet = octets[i];
                    if (!((0 <= octet && octet <= 255))) {
                        return null;
                    }
                }

                addr.parts.push(octets[0] << 8 | octets[1]);
                addr.parts.push(octets[2] << 8 | octets[3]);
                return {
                    parts: addr.parts,
                    zoneId: addr.zoneId
                };
            }
        }

        return null;
    };

    // Try to parse an array in network order (MSB first) for IPv4 and IPv6
    ipaddr.fromByteArray = function (bytes) {
        const length = bytes.length;

        if (length === 4) {
            return new ipaddr.IPv4(bytes);
        } else if (length === 16) {
            return new ipaddr.IPv6(bytes);
        } else {
            throw new Error('ipaddr: the binary input is neither an IPv6 nor IPv4 address');
        }
    };

    // Checks if the address is valid IP address
    ipaddr.isValid = function (string) {
        return ipaddr.IPv6.isValid(string) || ipaddr.IPv4.isValid(string);
    };

    // Attempts to parse an IP Address, first through IPv6 then IPv4.
    // Throws an error if it could not be parsed.
    ipaddr.parse = function (string) {
        if (ipaddr.IPv6.isValid(string)) {
            return ipaddr.IPv6.parse(string);
        } else if (ipaddr.IPv4.isValid(string)) {
            return ipaddr.IPv4.parse(string);
        } else {
            throw new Error('ipaddr: the address has neither IPv6 nor IPv4 format');
        }
    };

    // Attempt to parse CIDR notation, first through IPv6 then IPv4.
    // Throws an error if it could not be parsed.
    ipaddr.parseCIDR = function (string) {
        try {
            return ipaddr.IPv6.parseCIDR(string);
        } catch (e) {
            try {
                return ipaddr.IPv4.parseCIDR(string);
            } catch (e2) {
                throw new Error('ipaddr: the address has neither IPv6 nor IPv4 CIDR format');
            }
        }
    };

    // Parse an address and return plain IPv4 address if it is an IPv4-mapped address
    ipaddr.process = function (string) {
        const addr = this.parse(string);

        if (addr.kind() === 'ipv6' && addr.isIPv4MappedAddress()) {
            return addr.toIPv4Address();
        } else {
            return addr;
        }
    };

    // An utility function to ease named range matching. See examples below.
    // rangeList can contain both IPv4 and IPv6 subnet entries and will not throw errors
    // on matching IPv4 addresses to IPv6 ranges or vice versa.
    ipaddr.subnetMatch = function (address, rangeList, defaultName) {
        let i, rangeName, rangeSubnets, subnet;

        if (defaultName === undefined || defaultName === null) {
            defaultName = 'unicast';
        }

        for (rangeName in rangeList) {
            if (Object.prototype.hasOwnProperty.call(rangeList, rangeName)) {
                rangeSubnets = rangeList[rangeName];
                // ECMA5 Array.isArray isn't available everywhere
                if (rangeSubnets[0] && !(rangeSubnets[0] instanceof Array)) {
                    rangeSubnets = [rangeSubnets];
                }

                for (i = 0; i < rangeSubnets.length; i++) {
                    subnet = rangeSubnets[i];
                    if (address.kind() === subnet[0].kind() && address.match.apply(address, subnet)) {
                        return rangeName;
                    }
                }
            }
        }

        return defaultName;
    };

    // Export for both the CommonJS and browser-like environment
    if ( true && module.exports) {
        module.exports = ipaddr;

    } else {
        root.ipaddr = ipaddr;
    }

}(this));


/***/ }),

/***/ 689:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";
/*jslint node: true*/

module.exports = __webpack_require__(884);


/***/ }),

/***/ 884:
/***/ ((module) => {

"use strict";
/**
# qlobber&nbsp;&nbsp;&nbsp;[![ci](https://github.com/davedoesdev/qlobber/actions/workflows/ci.yml/badge.svg)](https://github.com/davedoesdev/qlobber/actions/workflows/ci.yml) [![Coverage Status](https://coveralls.io/repos/davedoesdev/qlobber/badge.png?branch=master)](https://coveralls.io/r/davedoesdev/qlobber?branch=master) [![NPM version](https://badge.fury.io/js/qlobber.png)](http://badge.fury.io/js/qlobber)

Node.js globbing for amqp-like topics.

__Note:__ Version 5.0.0 adds async and worker thread support when used on Node 12+.

Example:

```javascript
var assert = require('assert');
var Qlobber = require('qlobber').Qlobber;
var matcher = new Qlobber();
matcher.add('foo.*', 'it matched!');
assert.deepEqual(matcher.match('foo.bar'), ['it matched!']);
assert(matcher.test('foo.bar', 'it matched!'));
```

The API is described [here](#tableofcontents).

qlobber is implemented using a trie, as described in the RabbitMQ blog posts [here](http://www.rabbitmq.com/blog/2010/09/14/very-fast-and-scalable-topic-routing-part-1/) and [here](http://www.rabbitmq.com/blog/2011/03/28/very-fast-and-scalable-topic-routing-part-2/).

## Installation

```shell
npm install qlobber
```

## Another Example

A more advanced example using topics from the [RabbitMQ topic tutorial](http://www.rabbitmq.com/tutorials/tutorial-five-python.html):

```javascript
var assert = require('assert');
var Qlobber = require('qlobber').Qlobber;
var matcher = new Qlobber();
matcher.add('*.orange.*', 'Q1');
matcher.add('*.*.rabbit', 'Q2');
matcher.add('lazy.#', 'Q2');
assert.deepEqual(['quick.orange.rabbit',
                  'lazy.orange.elephant',
                  'quick.orange.fox',
                  'lazy.brown.fox',
                  'lazy.pink.rabbit',
                  'quick.brown.fox',
                  'orange',
                  'quick.orange.male.rabbit',
                  'lazy.orange.male.rabbit'].map(function (topic)
                  {
                      return matcher.match(topic).sort();
                  }),
                 [['Q1', 'Q2'],
                  ['Q1', 'Q2'],
                  ['Q1'],
                  ['Q2'],
                  ['Q2', 'Q2'],
                  [],
                  [],
                  [],
                  ['Q2']]);
```

## Async Example

Same as the first example but using `await`:

```javascript
const assert = require('assert');
const { Qlobber } = require('qlobber').set_native(require('qlobber-native'));
const matcher = new Qlobber.nativeString();

(async () => {
    await matcher.addP('foo.*', 'it matched!');
    assert.deepEqual(await matcher.matchP('foo.bar'), ['it matched!']);
    assert(await matcher.testP('foo.bar', 'it matched!'));
})();
```

## Worker Thread Example

Same again but the matching is done on a separate thread:

```
const { Qlobber } = require('qlobber').set_native(require('qlobber-native'));
const {
    Worker, isMainThread, parentPort, workerData
} = require('worker_threads');

if (isMainThread) {
    const matcher = new Qlobber.nativeString();
    matcher.add('foo.*', 'it matched!');
    const worker = new Worker(__filename, {
        workerData: matcher.state_address
    });
    worker.on('message', msg => {
        const assert = require('assert');
        assert.deepEqual(msg, [['it matched!'], true]);
    });
} else {
    const matcher = new Qlobber.nativeString(workerData);
    parentPort.postMessage([
        matcher.match('foo.bar'),
        matcher.test('foo.bar', 'it matched!')
    ]);
}
```

## Licence

[MIT](LICENCE)

## Tests

qlobber passes the [RabbitMQ topic tests](https://github.com/rabbitmq/rabbitmq-server/blob/master/src/rabbit_tests.erl) (I converted them from Erlang to Javascript).

To run the tests:

```shell
npm test
```

## Lint

```shell
grunt lint
```

## Code Coverage

```shell
npm run coverage
```

[c8](https://github.com/bcoe/c8) results are available [here](http://rawgit.davedoesdev.com/davedoesdev/qlobber/master/coverage/lcov-report/index.html).

Coveralls page is [here](https://coveralls.io/r/davedoesdev/qlobber).

## Benchmarks

```shell
grunt bench
```

qlobber is also benchmarked in [ascoltatori](https://github.com/mcollina/ascoltatori).

## Native Qlobbers

The Javascript Qlobbers don't support asynchronous calls and worker threads
because Javascript values can't be shared between threads.

In order to support asynchronous calls and worker threads, a native C++
implementation is available in the
[qlobber-native](https://www.npmjs.com/package/qlobber-native) module.

Add qlobber-native as a dependency to your project and then add it to qlobber
like this:

```javascript
require('qlobber').set_native(require('qlobber-native'));
```

Note that [`set_native`](#set_nativeqlobber_native) returns qlobber's exports so you can do something like
this:

```javascript
const { Qlobber } = require('qlobber').set_native(require('qlobber-native'));
```

Note that qlobber-native requires Gnu C++ version 9+ and Boost 1.70+,
including the `boost_context` runtime library.

Once's you've added it to qlobber, the following classes will be available
alongside the Javascript classes:

- `Qlobber.nativeString`
- `Qlobber.nativeNumber`
- `QlobberDedup.nativeString`
- `QlobberDedup.nativeNumber`
- `QlobberTrue.native`

They can only hold values of a single type (currently strings or numbers).

### Asynchronous calls

The native classes support the same API as the Javascript classes but have the
following additional methods:

- `addP`
- `removeP`
- `matchP`
- `match_iterP`
- `testP`
- `clearP`
- `visitP`
- `get_restorerP`

They correspond to their namesakes but return Promises. Note that `match_iterP`
and `visitP` return async iterators.

# API
*/

/*jslint node: true, nomen: true */


class Qlobber
{
/**
Creates a new qlobber.

@constructor
@param {Object} [options] Configures the qlobber. Use the following properties:
- `{String} separator` The character to use for separating words in topics. Defaults to '.'. MQTT uses '/' as the separator, for example.

- `{String} wildcard_one` The character to use for matching exactly one _non-empty_ word in a topic. Defaults to '*'. MQTT uses '+', for example.

- `{String} wildcard_some` The character to use for matching zero or more words in a topic. Defaults to '#'. MQTT uses '#' too.

- `{Boolean} match_empty_levels` If `true` then `wilcard_one` also matches an empty word in a topic. Defaults to `false`.

- `{Boolean|Map} cache_adds` Whether to cache topics when adding topic matchers. This will make adding multiple matchers for the same topic faster at the cost of extra memory usage. Defaults to `false`. If you supply a `Map` then it will be used to cache the topics (use this to enumerate all the topics in the qlobber).

- `{Integer} cache_splits` How many `topic.split` results to cache. When you pass in a topic, it has to be split on the `separator`. Caching the results will make using the same topics multiple times faster at the cost of extra memory usage. Defaults to `0` (no caching). The number of split results cached is limited by the value you pass here.

- `{Integer} max_words` Maximum number of words to allow in a topic. Defaults to 100.

- `{Integer} max_wildcard_somes` Maximum number of `wildcard_some` words in a topic. Defaults to 3.
*/
constructor (options)
{
    options = options || {};

    this._separator = options.separator || '.';
    this._wildcard_one = options.wildcard_one || '*';
    this._wildcard_some = options.wildcard_some || '#';
    this._max_words = options.max_words || 100;
    this._max_wildcard_somes = options.max_wildcard_somes || 3;
    this._match_empty_levels = options.match_empty_levels;
    this._trie = new Map();
    if (options.cache_adds instanceof Map)
    {
        this._shortcuts = options.cache_adds;
    }
    else if (options.cache_adds)
    {
        this._shortcuts = new Map();
    }
    if (options.cache_splits > 0)
    {
        this._cache_splits = options.cache_splits;
        this._split_cache = new Map();
    }
}

_initial_value = function (val)
{
    return [val];
};

_add_value = function (vals, val)
{
    vals[vals.length] = val;
};

_add_values = function (dest, origin)
{
    var i, destLength = dest.length, originLength = origin.length;

    for (i = 0; i < originLength; i += 1)
    {
        dest[destLength + i] = origin[i];
    }
};

_iter_values = function (origin, ctx)
{
    return origin[Symbol.iterator](ctx);
};

_remove_value = function (vals, val)
{
    if (val === undefined)
    {
        return true;
    }

    var index = vals.lastIndexOf(val);

    if (index >= 0)
    {
        vals.splice(index, 1);
    }

    return vals.length === 0;
};

_add = function (val, i, words, sub_trie)
{
    var st, word;

    if (i === words.length)
    {
        st = sub_trie.get(this._separator);
        
        if (st)
        {
            this._add_value(st, val);
        }
        else
        {
            st = this._initial_value(val);
            sub_trie.set(this._separator, st);
        }
        
        return st;
    }

    word = words[i];
    st = sub_trie.get(word);
    
    if (!st)
    {
        st = new Map();
        sub_trie.set(word, st);
    }
    
    return this._add(val, i + 1, words, st);
};

_remove = function (val, i, words, sub_trie)
{
    var st, word, r;

    if (i === words.length)
    {
        st = sub_trie.get(this._separator);

        if (st && this._remove_value(st, val))
        {
            sub_trie.delete(this._separator);
            return true;
        }

        return false;
    }
    
    word = words[i];
    st = sub_trie.get(word);

    if (!st)
    {
        return false;
    }

    r = this._remove(val, i + 1, words, st);

    if (st.size === 0)
    {
        sub_trie.delete(word);
    }

    return r;
};

_match_some = function (v, i, words, st, ctx)
{
    var j, w;

    for (w of st.keys())
    {
        if (w !== this._separator)
        {
            for (j = i; j < words.length; j += 1)
            {
                v = this._match(v, j, words, st, ctx);
            }
            break;
        }
    }

    return v;
};

_match = function (v, i, words, sub_trie, ctx)
{
    var word, st;

    st = sub_trie.get(this._wildcard_some);

    if (st)
    {
        // in the common case there will be no more levels...
        v = this._match_some(v, i, words, st, ctx);
        // and we'll end up matching the rest of the words:
        v = this._match(v, words.length, words, st, ctx);
    }

    if (i === words.length)
    {
        st = sub_trie.get(this._separator);

        if (st)
        {
            if (v.dest)
            {
                this._add_values(v.dest, v.source, ctx);
                this._add_values(v.dest, st, ctx);
                v = v.dest;
            }
            else if (v.source)
            {
                v.dest = v.source;
                v.source = st;
            }
            else
            {
                this._add_values(v, st, ctx);
            }
        }
    }
    else
    {
        word = words[i];

        if ((word !== this._wildcard_one) && (word !== this._wildcard_some))
        {
            st = sub_trie.get(word);

            if (st)
            {
                v = this._match(v, i + 1, words, st, ctx);
            }
        }

        if (word || this._match_empty_levels)
        {
            st = sub_trie.get(this._wildcard_one);

            if (st)
            {
                v = this._match(v, i + 1, words, st, ctx);
            }
        }
    }

    return v;
};

_match2 = function (v, topic, ctx)
{
    var vals = this._match(
    {
        source: v
    }, 0, this._split(topic, false), this._trie, ctx);

    return vals.source || vals;
};

_test_some = function (v, i, words, st)
{
    var j, w;

    for (w of st.keys())
    {
        if (w !== this._separator)
        {
            for (j = i; j < words.length; j += 1)
            {
                if (this._test(v, j, words, st))
                {
                    return true;
                }
            }
            break;
        }
    }

    return false;
};

_test = function (v, i, words, sub_trie)
{
    var word, st;

    st = sub_trie.get(this._wildcard_some);

    if (st)
    {
            // in the common case there will be no more levels...
        if (this._test_some(v, i, words, st) ||
            // and we'll end up matching the rest of the words:
            this._test(v, words.length, words, st))
        {
            return true;
        }
    }

    if (i === words.length)
    {
        st = sub_trie.get(this._separator);

        if (st && this.test_values(st, v))
        {
            return true;
        }
    }
    else
    {
        word = words[i];

        if ((word !== this._wildcard_one) && (word !== this._wildcard_some))
        {
            st = sub_trie.get(word);

            if (st && this._test(v, i + 1, words, st))
            {
                return true;
            }
        }

        if (word || this._match_empty_levels)
        {
            st = sub_trie.get(this._wildcard_one);

            if (st && this._test(v, i + 1, words, st))
            {
                return true;
            }
        }
    }

    return false;
};

_match_some_iter = function* (i, words, st, ctx)
{
    var j, w;

    for (w of st.keys())
    {
        if (w !== this._separator)
        {
            for (j = i; j < words.length; j += 1)
            {
                yield* this._match_iter(j, words, st, ctx);
            }
            break;
        }
    }
};

_match_iter = function* (i, words, sub_trie, ctx)
{
    var word, st;

    st = sub_trie.get(this._wildcard_some);

    if (st)
    {
        // in the common case there will be no more levels...
        yield* this._match_some_iter(i, words, st, ctx);
        // and we'll end up matching the rest of the words:
        yield* this._match_iter(words.length, words, st, ctx);
    }

    if (i === words.length)
    {
        st = sub_trie.get(this._separator);

        if (st)
        {
            yield* this._iter_values(st, ctx);
        }
    }
    else
    {
        word = words[i];

        if ((word !== this._wildcard_one) && (word !== this._wildcard_some))
        {
            st = sub_trie.get(word);

            if (st)
            {
                yield* this._match_iter(i + 1, words, st, ctx);
            }
        }

        if (word || this._match_empty_levels)
        {
            st = sub_trie.get(this._wildcard_one);

            if (st)
            {
                yield* this._match_iter(i + 1, words, st, ctx);
            }
        }
    }
};

_split_words = function (topic) {
    const r = topic.split(this._separator);
    if (r.length > this._max_words) {
        throw new Error('too many words');
    }
    return r;
};

_split = function (topic, adding) {
    let r;
    if (this._split_cache) {
        r = this._split_cache.get(topic);
        if (r === undefined) {
            r = this._split_words(topic);
            this._split_cache.set(topic, r);
            if (this._split_cache.size > this._cache_splits) {
                for (let t of this._split_cache.keys()) {
                    this._split_cache.delete(t);
                    break;
                }
            }
        }
    } else {
        r = this._split_words(topic);
    }
    if (adding &&
        (r.reduce((n, w) => n + (w === this._wildcard_some), 0) > this._max_wildcard_somes)) {
        throw new Error('too many wildcard somes');
    }
    return r;
};

/**
Add a topic matcher to the qlobber.

Note you can match more than one value against a topic by calling `add` multiple times with the same topic and different values.

@param {String} topic The topic to match against.
@param {Any} val The value to return if the topic is matched.
@return {Qlobber} The qlobber (for chaining).
*/
add = function (topic, val)
{
    var shortcut = this._shortcuts && this._shortcuts.get(topic);
    if (shortcut)
    {
        this._add_value(shortcut, val);
    }
    else
    {
        shortcut = this._add(val, 0, this._split(topic, true), this._trie);
        if (this._shortcuts)
        {
            this._shortcuts.set(topic, shortcut);
        }
    }
    return this;
};

/**
Remove a topic matcher from the qlobber.

@param {String} topic The topic that's being matched against.
@param {Any} [val] The value that's being matched. If you don't specify `val` then all matchers for `topic` are removed.
@return {Qlobber} The qlobber (for chaining).
*/
remove = function (topic, val)
{
    if (this._remove(val, 0, this._split(topic, false), this._trie) && this._shortcuts)
    {
        this._shortcuts.delete(topic);
    }
    return this;
};

/**
Match a topic.

@param {String} topic The topic to match against.
@return {Array} List of values that matched the topic. This may contain duplicates. Use a [`QlobberDedup`](#qlobberdedupoptions) if you don't want duplicates.
*/
match = function (topic, ctx)
{
    return this._match2([], topic, ctx);
};

/**
Match a topic, returning the matches one at a time.

@return {Iterator} An iterator on the values that match the topic. There may be duplicate values, even if you use a [`QlobberDedup`](#qlobberdedupoptions).
*/
match_iter = function (topic, ctx)
{
    return this._match_iter(0, this._split(topic, false), this._trie, ctx);
};

/**
Test whether a topic match contains a value. Faster than calling [`match`](#qlobberprototypematchtopic) and searching the result for the value. Values are tested using [`test_values`](#qlobberprototypetest_valuesvals-val).

@param {String} topic The topic to match against.
@param {Any} val The value being tested for.
@return {Boolean} Whether matching against `topic` contains `val`.
*/
test = function (topic, val)
{
    return this._test(val, 0, this._split(topic, false), this._trie);
};

/**
Test whether values found in a match contain a value passed to [`test`](#qlobberprototypetesttopic-val). You can override this to provide a custom implementation. Defaults to using `indexOf`.

@param {Array} vals The values found while matching.
@param {Any} val The value being tested for.
@return {Boolean} Whether `vals` contains `val`.
*/
test_values = function (vals, val)
{
    return vals.indexOf(val) >= 0;
};

/**
Reset the qlobber.

Removes all topic matchers from the qlobber.

@return {Qlobber} The qlobber (for chaining).
*/
clear = function ()
{
    this._trie.clear();
    if (this._shortcuts)
    {
        this._shortcuts.clear();
    }
    if (this._split_cache)
    {
        this._split_cache.clear();
    }
    return this;
};

// for debugging
get_trie = function ()
{
    return this._trie;
};

/**
Visit each node in the qlobber's trie in turn.

@return {Iterator} An iterator on the trie. The iterator returns objects which, if fed (in the same order) to the function returned by [`get_restorer`](#qlobberprototypeget_restoreroptions) on a different qlobber, will build that qlobber's trie to the same state. The objects can be serialized using `JSON.stringify`, _if_ the values you store in the qlobber are also serializable.
*/
visit = function* ()
{
    let iterators = [],
        iterator = this._trie.entries(),
        i = 0;

    while (true)
    {
        if (i === 0)
        {
            yield { type: 'start_entries' };
        }

        let next = iterator.next();

        if (next.done)
        {
            yield { type: 'end_entries' };

            let prev = iterators.pop();
            if (prev === undefined)
            {
                return;
            }

            [iterator, i] = prev;
            continue;
        }

        let [key, value] = next.value;
        yield { type: 'entry', key: key };
        ++i;

        if (key === this._separator)
        {
            yield { type: 'start_values' };

            if (value[Symbol.iterator])
            {
                for (let v of value)
                {
                    yield { type: 'value', value: v };
                }
            }
            else
            {
                yield { type: 'value', value: value };
            }

            yield { type: 'end_values' };
            continue;
        }

        iterators.push([iterator, i]);
        iterator = value.entries();
        i = 0;
    }
};

/**
Get a function which can restore the qlobber's trie to a state you retrieved
by calling [`visit`](#qlobberprototypevisit) on this or another qlobber.

@param {Object} [options] Options for restoring the trie.
- `{Boolean} cache_adds` Whether to cache topics when rebuilding the trie. This only applies if you also passed `cache_adds` as true in the [constructor](#qlobberoptions).

@return {Function} Function to call in order to rebuild the qlobber's trie. You should call this repeatedly with the objects you received from a call to [`visit`](#qlobberprototypevisit). If you serialized the objects, remember to deserialize them first (e.g. with `JSON.parse`)!
*/
get_restorer = function (options)
{
    options = options || {};

    let sts = [],
        entry = this._trie,
        path = '';

    return obj =>
    {
        switch (obj.type)
        {
            case 'entry':
                entry = entry || new Map();
                sts.push([entry, obj.key, path]);
                entry = entry.get(obj.key);
                if (options.cache_adds)
                {
                    if (path)
                    {
                        path += this._separator;
                    }
                    path += obj.key;
                }
                break;

            case 'value':
                if (entry)
                {
                    this._add_value(entry, obj.value);
                }
                else
                {
                    entry = this._initial_value(obj.value);
                }
                break;

            case 'end_entries':
                if (entry && (entry.size === 0))
                {
                    entry = undefined;
                }
                /* falls through */

            case 'end_values':
                let prev = sts.pop();
                if (prev === undefined)
                {
                    entry = undefined;
                    path = '';
                }
                else
                {
                    let [prev_entry, key, prev_path] = prev;
                    if (entry)
                    {
                        if (options.cache_adds &&
                            this._shortcuts &&
                            (obj.type === 'end_values'))
                        {
                            this._shortcuts.set(prev_path, entry);
                        }
                        prev_entry.set(key, entry);
                    }
                    entry = prev_entry;
                    path = prev_path;
                }
                break;
        }
    };
};
} // class Qlobber

if (false) {} // unused

class QlobberTrue extends Qlobber
{
/**
Creates a new qlobber which only stores the value `true`.

Whatever value you [`add`](#qlobberprototypeaddtopic-val) to this qlobber
(even `undefined`), a single, de-duplicated `true` will be stored. Use this
qlobber if you only need to test whether topics match, not about the values
they match to.

Inherits from [`Qlobber`](#qlobberoptions).

@constructor
@param {Object} [options] Same options as Qlobber.
*/
constructor (options)
{
    super(options);
}

_initial_value = function ()
{
    return true;
};

_add_value = function ()
{
};

_remove_value = function ()
{
    return true;
};

_iter_values = function* ()
{
    yield true;
};

/**
This override of [`test_values`](#qlobberprototypetest_valuesvals-val) always
returns `true`. When you call [`test`](#qlobberprototypetesttopic-val) on a
`QlobberTrue` instance, the value you pass is ignored since it only cares
whether a topic is matched.

@return {Boolean} Always `true`.
*/
test_values = function ()
{
    return true;    
};

/**
Match a topic.

Since `QlobberTrue` only cares whether a topic is matched and not about values
it matches to, this override of [`match`](#qlobberprototypematchtopic) just
calls [`test`](#qlobberprototypetesttopic-val) (with value `undefined`).

@param {String} topic The topic to match against.
@return {Boolean} Whether the `QlobberTrue` instance matches the topic.
*/
match = function (topic, ctx)
{
    return this.test(topic, ctx);
};
} // class QlobberTrue

if (false) {} // unused

module.exports = {
    Qlobber,
    QlobberTrue
};


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry need to be wrapped in an IIFE because it need to be in strict mode.
(() => {
"use strict";

;// CONCATENATED MODULE: ../lib/common/maybe.ts
function maybe_some(value) {
    return value !== undefined;
}
function maybe_none(value) {
    return value === undefined;
}
function serializeMaybe(value) {
    if (maybe_some(value)) {
        return value;
    }
    else {
        return null;
    }
}
function deserializeMaybe(value) {
    if (value === null) {
        return undefined;
    }
    else {
        return value;
    }
}
function maybe_isEqual(a, b) {
    return a === b;
}
var MaybeCompareOptions;
(function (MaybeCompareOptions) {
    MaybeCompareOptions[MaybeCompareOptions["none"] = 0] = "none";
    MaybeCompareOptions[MaybeCompareOptions["compareUndefined"] = 1] = "compareUndefined";
})(MaybeCompareOptions || (MaybeCompareOptions = {}));
function maybeCompare(a, b, compare = maybe_isEqual, options = MaybeCompareOptions.none) {
    if (maybe_some(a) && maybe_some(b)) {
        return compare(a, b);
    }
    if (options & MaybeCompareOptions.compareUndefined) {
        return maybe_none(a) && maybe_none(b);
    }
    return false;
}

;// CONCATENATED MODULE: ../lib/common/api-listener.ts


function suppressRuntimeErrors(knownErrorMessages) {
    const lastError = checkRuntimeLastError();
    if (maybe_none(lastError) || knownErrorMessages.some(m => lastError.startsWith(m))) {
        return;
    }
    logError(lastError);
}
function checkRuntimeLastError() {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
        return lastError.message;
    }
    return undefined;
}
class ApiListenerManager {
    constructor() {
        this.eventData = [];
    }
    addEvent(name, event, callback, filter, extraInfo) {
        this.eventData.push([name, event, callback, filter, extraInfo]);
    }
    registerListeners() {
        for (const [name, event, callback, filter, extraInfo] of this.eventData) {
            const hasListener = event.hasListener(callback);
            logObject('ApiListenerManager.registerListeners', {
                name,
                filter,
                extraInfo,
                hasListener,
            });
            if (!hasListener) {
                if (maybe_some(filter)) {
                    if (maybe_some(extraInfo)) {
                        event.addListener(callback, filter, extraInfo);
                    }
                    else {
                        event.addListener(callback, filter);
                    }
                }
                else {
                    event.addListener(callback);
                }
            }
        }
    }
    unregisterListeners() {
        for (const [name, event, callback, filter, extraInfo] of this.eventData) {
            const hasListener = event.hasListener(callback);
            logObject('ApiListenerManager.unregisterListeners', {
                name,
                filter,
                extraInfo,
                hasListener,
            });
            if (hasListener) {
                event.removeListener(callback);
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/murmur-hash.ts
function murmurHashString(key, seed) {
    let len = key.length * 2;
    const m = 0xc6a4a793;
    const r = 16;
    let h = seed ^ (len * m);
    for (let i = 0; (i < key.length) && (len >= 4); i += 2) {
        const data = (key.charCodeAt(i) + (key.charCodeAt(i + 1) << 16));
        const k = data;
        h += k;
        h *= m;
        h ^= (h >> 16);
        len -= 4;
    }
    if (len === 2) {
        let data = key.charCodeAt(key.length - 1);
        h += data;
        h *= m;
        h ^= (h >> r);
    }
    h *= m;
    h ^= (h >> 10);
    h *= m;
    h ^= (h >> 17);
    return h;
}
function murmurHashNumber(key, seed) {
    let len = 4;
    const m = 0xc6a4a793;
    const r = 16;
    let h = seed ^ (len * m);
    const data = key & 0xffffffff;
    const k = data;
    h += k;
    h *= m;
    h ^= (h >> 16);
    h *= m;
    h ^= (h >> 10);
    h *= m;
    h ^= (h >> 17);
    return h;
}
function murmur_hash_murmurHash(key, seed) {
    if (typeof key === 'string') {
        return murmurHashString(key, seed);
    }
    else if (typeof key === 'boolean') {
        return murmurHashNumber(key ? 1 : 0, seed);
    }
    else {
        return murmurHashNumber(key, seed);
    }
}

;// CONCATENATED MODULE: ../lib/common/hash-map.ts
function isPowerOf2(value) {
    const mask = value - 1;
    return (value & mask) === 0;
}
function mod(n, d) {
    return n & (d - 1);
}
var TryPutStatus;
(function (TryPutStatus) {
    TryPutStatus[TryPutStatus["ValueInserted"] = 0] = "ValueInserted";
    TryPutStatus[TryPutStatus["ValueUpdated"] = 1] = "ValueUpdated";
    TryPutStatus[TryPutStatus["Failure"] = 2] = "Failure";
})(TryPutStatus || (TryPutStatus = {}));
function convertToArray(elements, selector) {
    const filteredElements = elements.filter((element) => {
        return element !== undefined && element !== null;
    });
    const mappedElements = filteredElements.map(selector);
    return mappedElements;
}
class hash_map_HashMap {
    constructor(hash, compare, initialCapacity = 0, fillFactor = 0.75) {
        this.hash = hash;
        this.compare = compare;
        this.fillFactor = fillFactor;
        this.size = 0;
        this.elements = [];
        if (initialCapacity !== 0) {
            this.resize(initialCapacity);
        }
    }
    shouldResize(size) {
        if (this.elements.length === 0) {
            return true;
        }
        return (size / this.elements.length) >= this.fillFactor;
    }
    findNextCapacity() {
        if (this.elements.length === 0) {
            return 2;
        }
        return this.elements.length * 2;
    }
    findIndex(hash, elements = this.elements) {
        const index = mod(hash, elements.length);
        if (index < 0) {
            throw new Error(`HashMap.findIndex: index < 0: ${index} < 0`);
        }
        if (index >= elements.length) {
            throw new Error(`HashMap.findIndex: index >= elements.length: ${index} >= ${elements.length}`);
        }
        return index;
    }
    compareKeys(ha, ka, hb, kb) {
        return (ha === hb) && this.compare(ka, kb);
    }
    tryPut(hash, key, value, start, end, elements = this.elements) {
        for (let i = start; i < end; i += 1) {
            const element = elements[i];
            if (element !== undefined && element !== null) {
                const [currentHash, currentKey, currentValue] = element;
                if (this.compareKeys(hash, key, currentHash, currentKey)) {
                    elements[i] = [hash, key, value];
                    return TryPutStatus.ValueUpdated;
                }
            }
            else {
                elements[i] = [hash, key, value];
                return TryPutStatus.ValueInserted;
            }
        }
        return TryPutStatus.Failure;
    }
    resize(capacity) {
        if (capacity <= this.elements.length) {
            throw new Error(`HashMap.resize: capacity <= this.elements.length: ${capacity} <= ${this.elements.length}`);
        }
        if (capacity <= this.size) {
            throw new Error(`HashMap.resize: capacity <= this.size: ${capacity} <= ${this.size}`);
        }
        if (!isPowerOf2(capacity)) {
            throw new Error(`HashMap.resize: !isPowerOf2(${capacity})`);
        }
        const elements = new Array(capacity);
        for (let element of this.elements) {
            if (element !== undefined && element !== null) {
                const [hash, key, value] = element;
                const index = this.findIndex(hash, elements);
                if (this.tryPut(hash, key, value, index, elements.length, elements) !== TryPutStatus.Failure) {
                    continue;
                }
                if (this.tryPut(hash, key, value, 0, index, elements) !== TryPutStatus.Failure) {
                    continue;
                }
                throw new Error(`HashMap.resize: !tryPut`);
            }
        }
        this.elements = elements;
    }
    has(key) {
        return this.get(key) !== undefined;
    }
    isHole(element) {
        return element === undefined;
    }
    tryGet(hash, key, start, end) {
        const foundHole = true;
        for (let i = start; i < end; i += 1) {
            const element = this.elements[i];
            if (element !== undefined && element !== null) {
                const [currentHash, currentKey, currentValue] = element;
                if (this.compareKeys(hash, key, currentHash, currentKey)) {
                    return [!foundHole, currentValue];
                }
            }
            else if (this.isHole(element)) {
                return [foundHole, undefined];
            }
        }
        return [!foundHole, undefined];
    }
    get(key) {
        if (this.size === 0) {
            return undefined;
        }
        const hash = this.hash(key);
        const index = this.findIndex(hash);
        let [foundHole, value] = this.tryGet(hash, key, index, this.elements.length);
        if (value) {
            return value;
        }
        if (foundHole) {
            return undefined;
        }
        [foundHole, value] = this.tryGet(hash, key, 0, index);
        return value;
    }
    put(key, value) {
        if (this.shouldResize(this.size + 1)) {
            this.resize(this.findNextCapacity());
        }
        const hash = this.hash(key);
        const index = this.findIndex(hash);
        switch (this.tryPut(hash, key, value, index, this.elements.length)) {
            case TryPutStatus.ValueInserted:
                this.size += 1;
                return;
            case TryPutStatus.ValueUpdated:
                return;
        }
        switch (this.tryPut(hash, key, value, 0, index)) {
            case TryPutStatus.ValueInserted:
                this.size += 1;
                return;
            case TryPutStatus.ValueUpdated:
                return;
        }
        throw new Error('HashMap.put: !tryPut');
    }
    putMany(keyValues) {
        for (const [key, value] of keyValues) {
            this.put(key, value);
        }
    }
    tryRemove(hash, key, start, end) {
        const foundHole = true;
        const removed = true;
        for (let i = start; i < end; i += 1) {
            const element = this.elements[i];
            if (element !== undefined && element !== null) {
                const [currentHash, currentKey, currentValue] = element;
                if (this.compareKeys(hash, key, currentHash, currentKey)) {
                    this.elements[i] = null;
                    return [!foundHole, removed];
                }
            }
            else if (this.isHole(element)) {
                return [foundHole, !removed];
            }
        }
        return [!foundHole, !removed];
    }
    remove(key) {
        if (this.isEmpty()) {
            return false;
        }
        const hash = this.hash(key);
        const index = this.findIndex(hash);
        let [foundHole, removed] = this.tryRemove(hash, key, index, this.elements.length);
        if (removed) {
            this.size -= 1;
            return true;
        }
        if (foundHole) {
            return false;
        }
        [foundHole, removed] = this.tryRemove(hash, key, 0, index);
        if (removed) {
            this.size -= 1;
        }
        return removed;
    }
    isEmpty() {
        return this.size === 0;
    }
    toArray() {
        const selectKeyValue = ([hash, key, value]) => {
            return [key, value];
        };
        return convertToArray(this.elements, selectKeyValue);
    }
    *[Symbol.iterator]() {
        for (const element of this.elements) {
            if (element !== undefined && element !== null) {
                const [hash, key, value] = element;
                yield [key, value];
            }
        }
    }
}
class hash_map_HashSet {
    constructor(hash, compare, initialCapacity = 0, fillFactor = 0.75) {
        this.map = new hash_map_HashMap(hash, compare, initialCapacity, fillFactor);
    }
    get size() {
        return this.map.size;
    }
    addMany(keys) {
        let nKeysAdded = 0;
        for (const key of keys) {
            if (this.add(key)) {
                nKeysAdded += 1;
            }
        }
        return nKeysAdded;
    }
    add(key) {
        const sizeBefore = this.map.size;
        this.map.put(key, key);
        const sizeAfter = this.map.size;
        return (sizeAfter - sizeBefore) === 1;
    }
    has(key) {
        return this.map.has(key);
    }
    remove(key) {
        return this.map.remove(key);
    }
    isEmpty() {
        return this.map.isEmpty();
    }
    toArray() {
        const selectKey = ([hash, key, value]) => {
            return key;
        };
        return convertToArray(this.map.elements, selectKey);
    }
    *[Symbol.iterator]() {
        for (const element of this.map.elements) {
            if (element !== undefined && element !== null) {
                const [hash, key, value] = element;
                yield key;
            }
        }
    }
}
function defaultHash(instance) {
    return instance.hash();
}
function defaultCompare(a, b) {
    return a.compare(b);
}
function makeDefaultHashMap() {
    return new hash_map_HashMap(defaultHash, defaultCompare);
}
function makeDefaultHashSet() {
    return new hash_map_HashSet(defaultHash, defaultCompare);
}

;// CONCATENATED MODULE: ../lib/common/string-utils.ts



var StringCompareOptions;
(function (StringCompareOptions) {
    StringCompareOptions[StringCompareOptions["CaseSensitive"] = 0] = "CaseSensitive";
    StringCompareOptions[StringCompareOptions["LowerCase"] = 1] = "LowerCase";
    StringCompareOptions[StringCompareOptions["LocaleLowerCase"] = 2] = "LocaleLowerCase";
})(StringCompareOptions || (StringCompareOptions = {}));
function compareStrings(a, b, options = StringCompareOptions.CaseSensitive) {
    switch (options) {
        case StringCompareOptions.CaseSensitive:
            return a === b;
        case StringCompareOptions.LowerCase:
            return a.toLowerCase() === b.toLowerCase();
        case StringCompareOptions.LocaleLowerCase:
            return a.toLocaleLowerCase() === b.toLocaleLowerCase();
        default:
            throw new Error('stringCompare');
    }
}
function hashString(value) {
    let hash = 0;
    hash = murmur_hash_murmurHash(value, hash);
    return hash;
}
function makeStringHashSet() {
    return new hash_map_HashSet(hashString, compareStrings);
}
function makeStringHashMap() {
    return new hash_map_HashMap(hashString, compareStrings);
}
function line(value) {
    return `${value}\n`;
}
function surround(value, typeName, openTag, closeTag, indentLevel) {
    const indent = makeIndent(indentLevel - 1);
    if (value) {
        return `${line(`${typeName}${openTag}`)}${value}${indent(closeTag)}`;
    }
    else {
        return `${typeName}${openTag}${closeTag}`;
    }
}
function makeKeyValuePrinter(toString, indent) {
    return (key, value) => {
        return line(indent(`${toString(key)}: ${toString(value)},`));
    };
}
function mapToString(map, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printKeyValue = makeKeyValuePrinter(toString, indent);
    let result = "";
    map.forEach((value, key) => {
        result += printKeyValue(key, value);
    });
    return surround(result, "Map", "{", "}", indentLevel);
}
function makeValuePrinter(toString, indent) {
    return (value) => {
        return line(indent(`${toString(value)},`));
    };
}
function setToString(set, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printValue = makeValuePrinter(toString, indent);
    let result = "";
    set.forEach((key) => {
        result += printValue(key);
    });
    return surround(result, "Set", "{", "}", indentLevel);
}
function arrayToString(array, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printValue = makeValuePrinter(toString, indent);
    let result = "";
    if (array.length > 250) {
        result = printValue("...");
    }
    else {
        array.forEach((value) => {
            result += printValue(value);
        });
    }
    return surround(result, "Array", "[", "]", indentLevel);
}
function objectToString(value, seenObjects, indentLevel) {
    const indent = makeIndent(indentLevel);
    function toString(value) {
        return toStringRecursive(value, seenObjects, indentLevel);
    }
    const printKeyValue = makeKeyValuePrinter(toString, indent);
    let result = "";
    for (const propertyName of Object.getOwnPropertyNames(value)) {
        const property = value[propertyName];
        if (!isFunction(property)) {
            result += printKeyValue(propertyName, property);
        }
    }
    return surround(result, typeName(value), "{", "}", indentLevel);
}
const defaultToStringFunction = (() => {
    const emptyObject = {};
    return emptyObject.toString;
})();
function defaultToString(value) {
    return defaultToStringFunction.call(value);
}
function hasCustomToString(value) {
    return value.toString !== defaultToStringFunction;
}
function isFunction(value) {
    return value instanceof Function;
}
function makeIndentation(indentLevel) {
    if (indentLevel <= 0) {
        return "";
    }
    const tab = "\t";
    let indentation = "";
    for (let level = 0; level < indentLevel; level += 1) {
        indentation += tab;
    }
    return indentation;
}
function makeIndent(indentLevel) {
    const indentation = makeIndentation(indentLevel);
    return (value) => {
        return `${indentation}${value}`;
    };
}
function typeOf(value) {
    return value.constructor;
}
function typeName(value) {
    return typeOf(value).name;
}
function toStringRecursive(value, seenObjects, indentLevel) {
    function didSee(value) {
        return seenObjects.has(value);
    }
    function seeObject(value) {
        seenObjects.add(value);
        return seenObjects;
    }
    const nextIndentLevel = indentLevel + 1;
    if (value === undefined) {
        return "undefined";
    }
    else if (value === null) {
        return "null";
    }
    else if (typeof value === "boolean") {
        return value.toString();
    }
    else if (typeof value === "number") {
        return value.toString();
    }
    else if (typeof value === "string") {
        return value;
    }
    else if (value instanceof Array) {
        return arrayToString(value, seeObject(value), nextIndentLevel);
    }
    else if (value instanceof Map) {
        return mapToString(value, seeObject(value), nextIndentLevel);
    }
    else if (value instanceof Set) {
        return setToString(value, seeObject(value), nextIndentLevel);
    }
    else if (value instanceof URL) {
        return URLToString(value);
    }
    else if (isFunction(value)) {
        return typeName(value);
    }
    else if (didSee(value)) {
        return typeName(value);
    }
    else if (hasCustomToString(value)) {
        return value.toString();
    }
    else {
        return objectToString(value, seeObject(value), nextIndentLevel);
    }
}
function string_utils_toString(value, initialIndentLevel = 0) {
    const seenObjects = new Set();
    const indentLevel = initialIndentLevel;
    return toStringRecursive(value, seenObjects, indentLevel);
}
function safeToString(value) {
    if (value === undefined) {
        return "undefined";
    }
    else if (value === null) {
        return "null";
    }
    else {
        return value.toString();
    }
}
function isString(value) {
    return typeof value === 'string';
}
function isEmptyString(value) {
    return value.length === 0;
}
function toJSONString(value) {
    return JSON.stringify(value, undefined, 4);
}

;// CONCATENATED MODULE: ../lib/common/scheme.ts
var Scheme;
(function (Scheme) {
    Scheme["HTTP"] = "http:";
    Scheme["HTTPS"] = "https:";
    Scheme["FTP"] = "ftp:";
    Scheme["FTPS"] = "ftps:";
    Scheme["WS"] = "ws:";
    Scheme["WSS"] = "wss:";
    Scheme["FILE"] = "file:";
    Scheme["CHROME"] = "chrome:";
    Scheme["EDGE"] = "edge:";
    Scheme["ABOUT"] = "about:";
    Scheme["JAVASCRIPT"] = "javascript:";
    Scheme["CHROME_EXTENSION"] = "chrome-extension:";
    Scheme["FIREFOX_EXTENSION"] = "moz-extension:";
    Scheme["WILDCARD_ONE"] = "+:";
    Scheme["WILDCARD_SOME"] = "*:";
})(Scheme || (Scheme = {}));

;// CONCATENATED MODULE: ../lib/common/url-utils.ts




var UrlCompareOptions;
(function (UrlCompareOptions) {
    UrlCompareOptions[UrlCompareOptions["Default"] = 0] = "Default";
    UrlCompareOptions[UrlCompareOptions["IgnoreSearchParams"] = 1] = "IgnoreSearchParams";
})(UrlCompareOptions || (UrlCompareOptions = {}));
var UrlComponent;
(function (UrlComponent) {
    UrlComponent[UrlComponent["Protocol"] = 1] = "Protocol";
    UrlComponent[UrlComponent["Username"] = 2] = "Username";
    UrlComponent[UrlComponent["Password"] = 4] = "Password";
    UrlComponent[UrlComponent["Host"] = 8] = "Host";
    UrlComponent[UrlComponent["Port"] = 16] = "Port";
    UrlComponent[UrlComponent["Pathname"] = 32] = "Pathname";
    UrlComponent[UrlComponent["Search"] = 64] = "Search";
    UrlComponent[UrlComponent["All"] = 127] = "All";
})(UrlComponent || (UrlComponent = {}));
function compareUrlComponents(a, b, components) {
    function compare(component) {
        return (components & component) !== 0;
    }
    if (compare(UrlComponent.Protocol) && a.protocol !== b.protocol) {
        return false;
    }
    if (compare(UrlComponent.Username) && a.username !== b.username) {
        return false;
    }
    if (compare(UrlComponent.Password) && a.password !== b.password) {
        return false;
    }
    if (compare(UrlComponent.Host) && a.host !== b.host) {
        return false;
    }
    if (compare(UrlComponent.Port) && a.port !== b.port) {
        return false;
    }
    if (compare(UrlComponent.Pathname) && a.pathname !== b.pathname) {
        return false;
    }
    if (compare(UrlComponent.Search) && a.search !== b.search) {
        return false;
    }
    return true;
}
function removeComponent(components, component) {
    return components & (~component);
}
function url_utils_isSameUrl(a, b, options = UrlCompareOptions.Default) {
    switch (options) {
        case UrlCompareOptions.Default:
            return compareUrlComponents(a, b, UrlComponent.All);
        case UrlCompareOptions.IgnoreSearchParams:
            return compareUrlComponents(a, b, removeComponent(UrlComponent.All, UrlComponent.Search));
        default:
            throw new Error(`isSameUrl: invalid options: ${options}`);
    }
}
function isURL(value) {
    return value instanceof URL;
}
function url_utils_parseUrl(spec) {
    try {
        return new URL(spec);
    }
    catch (e) {
        return undefined;
    }
}
function maybeParseUrl(spec) {
    const url = url_utils_parseUrl(spec);
    if (url === undefined) {
        return spec;
    }
    else {
        return url;
    }
}
function parseURLIfNecessary(urlOrSpec) {
    if (isURL(urlOrSpec)) {
        return urlOrSpec;
    }
    else {
        return url_utils_parseUrl(urlOrSpec);
    }
}
function isSameUrlOrSpec(a, b, options = UrlCompareOptions.Default) {
    if ((a instanceof URL) && (b instanceof URL)) {
        return url_utils_isSameUrl(a, b);
    }
    else if ((typeof a === "string") && (typeof b === "string")) {
        return a === b;
    }
    else {
        return undefined;
    }
}
function isFileUrl(url) {
    return compareStrings(url.protocol, Scheme.FILE);
}
function isExtensionUrl(url) {
    const extensionSchemes = [
        Scheme.CHROME_EXTENSION,
        Scheme.FIREFOX_EXTENSION
    ];
    return extensionSchemes.some((extensionScheme) => compareStrings(url.protocol, extensionScheme));
}
function isBrowserUrl(url) {
    const browserSchemes = [
        Scheme.CHROME,
        Scheme.ABOUT,
        Scheme.EDGE
    ];
    return browserSchemes.some((browserScheme) => compareStrings(url.protocol, browserScheme));
}
function URLToString(url) {
    if (url === undefined) {
        return "";
    }
    if (url instanceof URL) {
        return url.toString();
    }
    else {
        return url;
    }
}
function safeEncodeURI(uri) {
    if (uri === undefined) {
        return "";
    }
    return encodeURI(uri);
}
function safeEncodeURIComponent(component) {
    if (component === undefined) {
        return "";
    }
    return encodeURIComponent(component);
}
function hashUrlComponents(url, components, seed) {
    function compare(component) {
        return (components & component) !== 0;
    }
    let hash = seed;
    if (compare(UrlComponent.Protocol)) {
        hash = murmur_hash_murmurHash(url.protocol, hash);
    }
    if (compare(UrlComponent.Username)) {
        hash = murmur_hash_murmurHash(url.username, hash);
    }
    if (compare(UrlComponent.Password)) {
        hash = murmur_hash_murmurHash(url.password, hash);
    }
    if (compare(UrlComponent.Host)) {
        hash = murmur_hash_murmurHash(url.host, hash);
    }
    if (compare(UrlComponent.Port)) {
        hash = murmur_hash_murmurHash(url.port, hash);
    }
    if (compare(UrlComponent.Pathname)) {
        hash = murmur_hash_murmurHash(url.pathname, hash);
    }
    if (compare(UrlComponent.Search)) {
        hash = murmur_hash_murmurHash(url.search, hash);
    }
    return hash;
}
function hashUrl(url, options = UrlCompareOptions.Default, seed = 0) {
    switch (options) {
        case UrlCompareOptions.Default:
            return hashUrlComponents(url, UrlComponent.All, seed);
        case UrlCompareOptions.IgnoreSearchParams:
            return hashUrlComponents(url, removeComponent(UrlComponent.All, UrlComponent.Search), seed);
        default:
            throw new Error(`hashUrl: invalid options: ${options}`);
    }
}
function makeUrlHashMap(options = UrlCompareOptions.Default) {
    return new HashMap((url) => hashUrl(url, options), (a, b) => url_utils_isSameUrl(a, b, options));
}
function makeUrlHashSet(options = UrlCompareOptions.Default) {
    return new hash_map_HashSet((url) => hashUrl(url, options), (a, b) => url_utils_isSameUrl(a, b, options));
}

;// CONCATENATED MODULE: ../lib/common/browser.ts



var Browser;
(function (Browser) {
    Browser[Browser["chrome"] = 0] = "chrome";
    Browser[Browser["firefox"] = 1] = "firefox";
    Browser[Browser["edgeChromium"] = 2] = "edgeChromium";
})(Browser || (Browser = {}));
const browserSchemeMap = new Map([
    [Scheme.CHROME_EXTENSION, Browser.chrome],
    [Scheme.FIREFOX_EXTENSION, Browser.firefox],
]);
const currentBrowser = (() => {
    var _a;
    const manifestURL = url_utils_parseUrl(chrome.runtime.getURL("manifest.json"));
    if (maybe_none(manifestURL)) {
        return undefined;
    }
    let browser = browserSchemeMap.get(manifestURL.protocol);
    if (browser === Browser.chrome) {
        if ((_a = navigator.userAgentData) === null || _a === void 0 ? void 0 : _a.brands.some(brandInfo => brandInfo.brand === "Microsoft Edge")) {
            browser = Browser.edgeChromium;
        }
    }
    return browser;
})();
function getCurrentBrowserInfo() {
    const manifestURL = url_utils_parseUrl(chrome.runtime.getURL("manifest.json"));
    if (maybe_none(manifestURL) || maybe_none(currentBrowser)) {
        return { browser: "unknown", urlHostname: "" };
    }
    return { browser: Browser[currentBrowser], urlHostname: manifestURL.hostname };
}
function browserToDisplayString(browser) {
    switch (browser) {
        case Browser.chrome:
            return "Google Chrome";
        case Browser.firefox:
            return "Mozilla Firefox";
        case Browser.edgeChromium:
            return "Microsoft Edge";
    }
}

;// CONCATENATED MODULE: ../lib/common/date-utils.ts
function currentDateTimeString() {
    return new Date().toISOString();
}

;// CONCATENATED MODULE: ../lib/common/storage.ts
var StorageKey;
(function (StorageKey) {
    StorageKey["configMessage"] = "configMessage";
    StorageKey["reputableSites"] = "reputableSites";
    StorageKey["enabledFeatures"] = "enabledFeatures";
    StorageKey["failedReloadAttempts"] = "failedReloadAttempts";
    StorageKey["historySeeder"] = "historySeeder";
    StorageKey["customerList"] = "customerList";
    StorageKey["userEnabledLogging"] = "userEnabledLogging";
})(StorageKey || (StorageKey = {}));

;// CONCATENATED MODULE: ../lib/common/once.ts
function doOnce(action) {
    let done = false;
    return () => {
        if (!done) {
            done = true;
            action();
        }
    };
}

;// CONCATENATED MODULE: ../lib/common/event-dispatcher.ts

class EventDispatcher {
    constructor() {
        this.eventHandlers = new Array();
        this.oneShotEventHandlers = new Array();
    }
    registerEventHandler(eventHandler) {
        this.eventHandlers.push(eventHandler);
    }
    registerOneShotEventHandler(eventHandler) {
        this.oneShotEventHandlers.push(eventHandler);
    }
    dispatchEvent(event) {
        for (const handleEvent of this.eventHandlers) {
            handleEvent(event);
        }
        for (const handleEvent of this.oneShotEventHandlers) {
            handleEvent(event);
        }
        this.oneShotEventHandlers = [];
    }
}
class ConditionDispatcher {
    constructor() {
        this.setCondition = doOnce(() => { this.setConditionImpl(); });
        this.condition = false;
        this.conditionHandlers = new Array();
    }
    registerConditionListener(conditionHandler) {
        if (this.condition) {
            conditionHandler();
        }
        else {
            this.conditionHandlers.push(conditionHandler);
        }
    }
    setConditionImpl() {
        this.condition = true;
        for (const handleCondition of this.conditionHandlers) {
            handleCondition();
        }
        this.conditionHandlers = [];
    }
}

;// CONCATENATED MODULE: ../lib/common/log.ts







class ConsoleLogSink {
    constructor() {
        this.logError = this.log;
    }
    log(message) {
        console.log(message);
    }
}
class BaseLogger {
    constructor() {
        this.enabledChanged = new EventDispatcher();
        this.sinks = [];
        this.addSink(new ConsoleLogSink());
    }
    addSink(sink) {
        this.sinks.push(sink);
    }
    formatMessage(message) {
        return `${currentDateTimeString()}: ${message}`;
    }
    log(message) {
        const formattedMessage = this.formatMessage(message);
        for (const sink of this.sinks) {
            sink.log(formattedMessage);
        }
    }
    logError(error) {
        const message = errorToString(error);
        const formattedMessage = this.formatMessage(message);
        for (const sink of this.sinks) {
            sink.logError(formattedMessage);
        }
    }
    get isEnabled() {
        return true;
    }
    set isEnabled(enabled) { }
}
class FirefoxLogger extends BaseLogger {
    constructor() {
        super();
        this.enabled = false;
        this.messageQueue = [];
        const key = FirefoxLogger.storageKey;
        chrome.storage.local.get(key, result => {
            var _a;
            const enabled = (_a = result[key]) !== null && _a !== void 0 ? _a : false;
            this.onEnabledChanged(enabled);
            chrome.storage.onChanged.addListener((changes, areaName) => {
                var _a;
                const newEnabled = (_a = changes[key]) === null || _a === void 0 ? void 0 : _a.newValue;
                if (maybe_some(newEnabled) && this.enabled !== newEnabled) {
                    this.onEnabledChanged(newEnabled);
                }
            });
        });
    }
    static get storageKey() {
        return StorageKey.userEnabledLogging;
    }
    log(message) {
        const queue = this.messageQueue;
        if (maybe_some(queue)) {
            queue.push(message);
        }
        else if (this.isEnabled) {
            super.log(message);
        }
    }
    logError(error) {
        const queue = this.messageQueue;
        if (maybe_some(queue)) {
            queue.push(error);
        }
        else if (this.isEnabled) {
            super.logError(error);
        }
    }
    get isEnabled() {
        return this.enabled;
    }
    set isEnabled(enabled) {
        if (this.enabled === enabled) {
            return;
        }
        this.storeSetting(enabled);
        this.onEnabledChanged(enabled);
    }
    onEnabledChanged(enabled) {
        this.enabled = enabled;
        const queue = this.messageQueue;
        this.messageQueue = undefined;
        if (maybe_some(queue) && enabled) {
            this.drainQueue(queue);
        }
        this.enabledChanged.dispatchEvent(enabled);
    }
    drainQueue(queue) {
        for (const message of queue) {
            if (message instanceof Error) {
                super.logError(message);
            }
            else {
                super.log(message);
            }
        }
    }
    storeSetting(enabled) {
        const key = FirefoxLogger.storageKey;
        chrome.storage.local.set({ [key]: enabled }, () => {
            const error = checkRuntimeLastError();
            if (maybe_some(error)) {
                logError(`Error while storing that the user enabled logging: ${error}`);
            }
        });
    }
}
class DefaultLogger extends BaseLogger {
    constructor() {
        super();
    }
}
function makeLogger() {
    switch (currentBrowser) {
        case Browser.firefox:
            return new FirefoxLogger();
        default:
            return new DefaultLogger();
    }
}
const logger = makeLogger();
function tryLog(log) {
    try {
        log();
    }
    catch (_a) {
        try {
            const error = new Error('tryLog');
            console.error(error);
        }
        catch (_b) { }
    }
}
function errorToString(error) {
    var _a, _b;
    return toJSONString({
        name: error.name,
        message: error.message,
        stack: (_b = (_a = error.stack) === null || _a === void 0 ? void 0 : _a.split('\n')) !== null && _b !== void 0 ? _b : []
    });
}
function log_log(message) {
    tryLog(() => {
        logger.log(message);
    });
}
function logObject(msg, o) {
    tryLog(() => {
        logger.log(`${msg}: ${toJSONString(o)}`);
    });
}
function isError(value) {
    return value instanceof Error;
}
function logError(errorOrMessage) {
    tryLog(() => {
        var _a;
        const error = (isError(errorOrMessage) ? errorOrMessage :
            isString(errorOrMessage) ? new Error(errorOrMessage) :
                new Error((_a = errorOrMessage === null || errorOrMessage === void 0 ? void 0 : errorOrMessage.toString()) !== null && _a !== void 0 ? _a : ''));
        logger.logError(error);
    });
}

;// CONCATENATED MODULE: ../lib/common/alarms.ts


var AlarmName;
(function (AlarmName) {
    AlarmName["customerBecListFetch"] = "customerBecFetch";
    AlarmName["hpCloudListClearDeadEntries"] = "hpCloudCDE";
    AlarmName["urlFilteringClearDeadEntries"] = "urlFilteringCDE";
})(AlarmName || (AlarmName = {}));
class AlarmManager {
    constructor() {
        this.callbacks = new Map();
        chrome.alarms.clearAll();
        chrome.alarms.onAlarm.addListener(alarm => {
            const callback = this.callbacks.get(alarm.name);
            if (maybe_some(callback)) {
                callback();
            }
            else {
                logError(`onAlarm: no callback found for alarm with name "${alarm.name}"`);
            }
        });
    }
    registerPeriodicAlarm(name, periodInMinutes, callback) {
        this.callbacks.set(name, callback);
        chrome.alarms.create(name, { periodInMinutes });
    }
}

;// CONCATENATED MODULE: ../lib/common/promise-utils.ts
function makePromise(factory) {
    return new Promise((resolve, reject) => {
        resolve(factory());
    });
}
function makePromiseAsync(factory) {
    return new Promise((resolve, reject) => {
        factory(resolve);
    });
}
const wrap = (func) => {
    return (...args) => {
        return new Promise(resolve => {
            func(...args, (result) => resolve(result));
        });
    };
};

;// CONCATENATED MODULE: ../lib/common/compat.ts

const manifestVersion = (() => {
    const manifest = chrome.runtime.getManifest();
    return manifest.manifest_version;
})();
const compatV3 = {
    tabs: chrome.tabs,
    storage: chrome.storage,
    permissions: {
        contains: wrap(chrome.permissions.contains),
    },
    management: chrome.management,
};
const compatV2 = {
    tabs: {
        get: wrap(chrome.tabs.get),
        query: wrap(chrome.tabs.query),
        reload: wrap(chrome.tabs.reload),
        update: wrap(chrome.tabs.update)
    },
    storage: {
        local: {
            get: wrap(chrome.storage.local.get),
            set: wrap(chrome.storage.local.set),
            remove: wrap(chrome.storage.local.remove)
        }
    },
    permissions: {
        contains: wrap(chrome.permissions.contains),
    },
    management: {
        getSelf: wrap(chrome.management.getSelf),
    },
};
const compat = (() => {
    switch (manifestVersion) {
        case 2:
            return compatV2;
        case 3:
            return compatV3;
        default:
            throw new Error(`Invalid manifest version: ${manifestVersion}`);
    }
})();

;// CONCATENATED MODULE: ../lib/common/id-generator.ts


class IdGenerator {
    constructor() {
        this.nextId = 0;
    }
    generateId() {
        const id = this.nextId;
        this.nextId += 1;
        return id;
    }
}
function hashId(id, seed = 0) {
    return murmurHash(id, seed);
}
function isSameId(a, b) {
    return a === b;
}
function makeIdHashSet() {
    return new HashSet(hashId, isSameId);
}
function makeIdHashMap() {
    return new HashMap(hashId, isSameId);
}

;// CONCATENATED MODULE: ../lib/common/request-response-handler.ts


class RequestResponseHandler {
    constructor(requestType, responseType, makeRequest, readResponse, messageRouter, messageSender) {
        this.requestType = requestType;
        this.makeRequest = makeRequest;
        this.readResponse = readResponse;
        this.messageSender = messageSender;
        this.idGenerator = new IdGenerator();
        this.requests = new Map();
        messageRouter.registerMessageHandler(responseType, (message) => this.handleResponse(message));
    }
    sendRequest(data, onResponse) {
        const id = this.idGenerator.generateId();
        this.requests.set(id, [data, onResponse]);
        const request = this.makeRequest(id, data);
        this.messageSender.sendMessage(this.requestType, request);
    }
    handleResponse(message) {
        const [id, result] = this.readResponse(message.payload);
        const request = this.requests.get(id);
        if (maybe_none(request)) {
            return;
        }
        this.requests.delete(id);
        const [data, onResponse] = request;
        onResponse(data, result);
    }
}

;// CONCATENATED MODULE: ../lib/common/type-utils.ts
function isObject(value) {
    return value instanceof Object;
}
function isBoolean(value) {
    return typeof value === "boolean";
}

;// CONCATENATED MODULE: ../lib/common/number-utils.ts
function isInRange(value, min, max) {
    return (value >= min) && (value <= max);
}
function isNumber(value) {
    return typeof value === "number";
}

;// CONCATENATED MODULE: ../lib/host/message-types.ts

var MessageType;
(function (MessageType) {
    MessageType[MessageType["handshakeV1"] = 0] = "handshakeV1";
    MessageType[MessageType["launchBrowserRequestV1"] = 1] = "launchBrowserRequestV1";
    MessageType[MessageType["launchBrowserResponseV1"] = 2] = "launchBrowserResponseV1";
    MessageType[MessageType["pageEventV1"] = 3] = "pageEventV1";
    MessageType[MessageType["configRequestV1"] = 4] = "configRequestV1";
    MessageType[MessageType["configChangedV1"] = 5] = "configChangedV1";
    MessageType[MessageType["trustUrlV1"] = 6] = "trustUrlV1";
    MessageType[MessageType["downloadCompleteV1"] = 7] = "downloadCompleteV1";
    MessageType[MessageType["logMessageV1"] = 8] = "logMessageV1";
    MessageType[MessageType["addUserTrustedOriginV1"] = 9] = "addUserTrustedOriginV1";
    MessageType[MessageType["addUserUntrustedOriginV1"] = 10] = "addUserUntrustedOriginV1";
    MessageType[MessageType["helperErrorV1"] = 11] = "helperErrorV1";
    MessageType[MessageType["dormantStateChangedV1"] = 12] = "dormantStateChangedV1";
    MessageType[MessageType["extensionReadyV1"] = 13] = "extensionReadyV1";
    MessageType[MessageType["externalAppLinkRequestV1"] = 14] = "externalAppLinkRequestV1";
    MessageType[MessageType["externalAppLinkResponseV1"] = 15] = "externalAppLinkResponseV1";
    MessageType[MessageType["isFileURLTrustedRequestV1"] = 16] = "isFileURLTrustedRequestV1";
    MessageType[MessageType["isFileURLTrustedResponseV1"] = 17] = "isFileURLTrustedResponseV1";
    MessageType[MessageType["blockedFileRequestV1"] = 18] = "blockedFileRequestV1";
    MessageType[MessageType["blockedFileResponseV1"] = 19] = "blockedFileResponseV1";
    MessageType[MessageType["popupDataRequestV1"] = 20] = "popupDataRequestV1";
    MessageType[MessageType["popupDataResponseV1"] = 21] = "popupDataResponseV1";
    MessageType[MessageType["clearRememberedDecisionsV1"] = 22] = "clearRememberedDecisionsV1";
    MessageType[MessageType["blockedPageStringsRequestV1"] = 23] = "blockedPageStringsRequestV1";
    MessageType[MessageType["blockedPageStringsResponseV1"] = 24] = "blockedPageStringsResponseV1";
    MessageType[MessageType["heartbeatV1"] = 25] = "heartbeatV1";
    MessageType[MessageType["enabledFeaturesRequestV2"] = 26] = "enabledFeaturesRequestV2";
    MessageType[MessageType["enabledFeaturesResponseV2"] = 27] = "enabledFeaturesResponseV2";
    MessageType[MessageType["clearRememberedOriginV3"] = 28] = "clearRememberedOriginV3";
    MessageType[MessageType["optionsDataRequestV3"] = 29] = "optionsDataRequestV3";
    MessageType[MessageType["optionsDataResponseV3"] = 30] = "optionsDataResponseV3";
    MessageType[MessageType["configChangedV3"] = 31] = "configChangedV3";
    MessageType[MessageType["reputationChangedV3"] = 32] = "reputationChangedV3";
    MessageType[MessageType["configChangedV4"] = 33] = "configChangedV4";
    MessageType[MessageType["blockedPageDataRequestV4"] = 34] = "blockedPageDataRequestV4";
    MessageType[MessageType["blockedPageDataResponseV4"] = 35] = "blockedPageDataResponseV4";
    MessageType[MessageType["configChangedV5"] = 36] = "configChangedV5";
    MessageType[MessageType["popupDataResponseV5"] = 37] = "popupDataResponseV5";
    MessageType[MessageType["blockedPageDataResponseV6"] = 38] = "blockedPageDataResponseV6";
    MessageType[MessageType["trustUrlV6"] = 39] = "trustUrlV6";
    MessageType[MessageType["configChangedV7"] = 40] = "configChangedV7";
    MessageType[MessageType["trustUrlV8"] = 41] = "trustUrlV8";
    MessageType[MessageType["dontAskAgainV8"] = 42] = "dontAskAgainV8";
    MessageType[MessageType["configChangedV8"] = 43] = "configChangedV8";
    MessageType[MessageType["popupDataResponseV9"] = 44] = "popupDataResponseV9";
    MessageType[MessageType["dontAskAgainV9"] = 45] = "dontAskAgainV9";
    MessageType[MessageType["configChangedV9"] = 46] = "configChangedV9";
    MessageType[MessageType["stopHelperV10"] = 47] = "stopHelperV10";
    MessageType[MessageType["edgeAckV10"] = 48] = "edgeAckV10";
    MessageType[MessageType["endOfStreamV10"] = 49] = "endOfStreamV10";
    MessageType[MessageType["heartbeatV10"] = 50] = "heartbeatV10";
    MessageType[MessageType["popupDataResponseV11"] = 51] = "popupDataResponseV11";
    MessageType[MessageType["configChangedV11"] = 52] = "configChangedV11";
    MessageType[MessageType["configChangedV12"] = 53] = "configChangedV12";
    MessageType[MessageType["configChangedV13"] = 54] = "configChangedV13";
    MessageType[MessageType["configChangedV14"] = 55] = "configChangedV14";
    MessageType[MessageType["configChangedV15"] = 56] = "configChangedV15";
    MessageType[MessageType["externalAppLinkRequestV16"] = 57] = "externalAppLinkRequestV16";
    MessageType[MessageType["configChangedV17"] = 58] = "configChangedV17";
    MessageType[MessageType["popupDataResponseV18"] = 59] = "popupDataResponseV18";
    MessageType[MessageType["popupDataResponseV19"] = 60] = "popupDataResponseV19";
    MessageType[MessageType["configChangedV19"] = 61] = "configChangedV19";
    MessageType[MessageType["configChangedV20"] = 62] = "configChangedV20";
    MessageType[MessageType["popupDataResponseV21"] = 63] = "popupDataResponseV21";
    MessageType[MessageType["configChangedV21"] = 64] = "configChangedV21";
    MessageType[MessageType["phishingDetectionTrippedV22"] = 65] = "phishingDetectionTrippedV22";
    MessageType[MessageType["phishingDetectionSuppressedV22"] = 66] = "phishingDetectionSuppressedV22";
    MessageType[MessageType["phishingInformationSubmittedV22"] = 67] = "phishingInformationSubmittedV22";
    MessageType[MessageType["frameLoadResponseV22"] = 68] = "frameLoadResponseV22";
    MessageType[MessageType["contentScriptDataV22"] = 69] = "contentScriptDataV22";
    MessageType[MessageType["onFrameDomUpdateV22"] = 70] = "onFrameDomUpdateV22";
    MessageType[MessageType["freezeScreenshotV22"] = 71] = "freezeScreenshotV22";
    MessageType[MessageType["onOverlayClickV22"] = 72] = "onOverlayClickV22";
    MessageType[MessageType["onPhishingCategoryChangedV22"] = 73] = "onPhishingCategoryChangedV22";
    MessageType[MessageType["phishingCategoryRequestV22"] = 74] = "phishingCategoryRequestV22";
    MessageType[MessageType["phishingCategoryResponseV22"] = 75] = "phishingCategoryResponseV22";
    MessageType[MessageType["phishingHostStatusChangeV22"] = 76] = "phishingHostStatusChangeV22";
    MessageType[MessageType["preparePhishingReportV22"] = 77] = "preparePhishingReportV22";
    MessageType[MessageType["addPhishingReportActionV22"] = 78] = "addPhishingReportActionV22";
    MessageType[MessageType["sendPhishingReportV22"] = 79] = "sendPhishingReportV22";
    MessageType[MessageType["helperRunningV22"] = 80] = "helperRunningV22";
    MessageType[MessageType["helperExitedV22"] = 81] = "helperExitedV22";
    MessageType[MessageType["optionsDataResponseV22"] = 82] = "optionsDataResponseV22";
    MessageType[MessageType["configChangedV22"] = 83] = "configChangedV22";
    MessageType[MessageType["configChangedV23"] = 84] = "configChangedV23";
    MessageType[MessageType["popupDataResponseV24"] = 85] = "popupDataResponseV24";
    MessageType[MessageType["identityProtectionRunningV24"] = 86] = "identityProtectionRunningV24";
    MessageType[MessageType["configChangedV24"] = 87] = "configChangedV24";
    MessageType[MessageType["popupDataResponseV25"] = 88] = "popupDataResponseV25";
    MessageType[MessageType["showUrlFilteringOverlayV26"] = 89] = "showUrlFilteringOverlayV26";
    MessageType[MessageType["makeUrlFilteringAlertV26"] = 90] = "makeUrlFilteringAlertV26";
    MessageType[MessageType["configChangedV26"] = 91] = "configChangedV26";
    MessageType[MessageType["makeUrlFilteringAlertV27"] = 92] = "makeUrlFilteringAlertV27";
    MessageType[MessageType["preparePhishingReportV28"] = 93] = "preparePhishingReportV28";
    MessageType[MessageType["configChangedV28"] = 94] = "configChangedV28";
    MessageType[MessageType["showDomainAgeUrlFilteringOverlayV28"] = 95] = "showDomainAgeUrlFilteringOverlayV28";
    MessageType[MessageType["makeUrlFilteringAlertV28"] = 96] = "makeUrlFilteringAlertV28";
    MessageType[MessageType["configChangedV29"] = 97] = "configChangedV29";
    MessageType[MessageType["showStatusMsgUrlFilteringOverlayV29"] = 98] = "showStatusMsgUrlFilteringOverlayV29";
    MessageType[MessageType["downloadCreatedV30"] = 99] = "downloadCreatedV30";
    MessageType[MessageType["analyseWebsiteScreenshotOpportunityEventV31"] = 100] = "analyseWebsiteScreenshotOpportunityEventV31";
    MessageType[MessageType["analyseWebsiteScreenshotRequestV31"] = 101] = "analyseWebsiteScreenshotRequestV31";
    MessageType[MessageType["analyseWebsiteScreenshotResponseV31"] = 102] = "analyseWebsiteScreenshotResponseV31";
    MessageType[MessageType["onLogoAnalysisCompleteV31"] = 103] = "onLogoAnalysisCompleteV31";
    MessageType[MessageType["preparePhishingReportV32"] = 104] = "preparePhishingReportV32";
    MessageType[MessageType["configChangedV33"] = 105] = "configChangedV33";
    MessageType[MessageType["minMessageType"] = 0] = "minMessageType";
    MessageType[MessageType["maxMessageType"] = 105] = "maxMessageType";
})(MessageType || (MessageType = {}));
function isMessageType(type) {
    return isInRange(type, MessageType.minMessageType, MessageType.maxMessageType);
}
const frequentlySentMessageTypes = new Set([
    MessageType.logMessageV1,
    MessageType.pageEventV1,
    MessageType.heartbeatV1,
    MessageType.extensionReadyV1,
    MessageType.heartbeatV10,
    MessageType.phishingDetectionTrippedV22,
    MessageType.phishingDetectionSuppressedV22,
    MessageType.phishingInformationSubmittedV22,
    MessageType.frameLoadResponseV22,
    MessageType.contentScriptDataV22,
    MessageType.onFrameDomUpdateV22,
    MessageType.freezeScreenshotV22,
    MessageType.onOverlayClickV22,
    MessageType.onPhishingCategoryChangedV22,
    MessageType.blockedFileRequestV1,
    MessageType.blockedFileResponseV1,
    MessageType.externalAppLinkRequestV16,
    MessageType.externalAppLinkResponseV1,
    MessageType.showUrlFilteringOverlayV26,
    MessageType.showDomainAgeUrlFilteringOverlayV28,
    MessageType.showStatusMsgUrlFilteringOverlayV29,
    MessageType.analyseWebsiteScreenshotOpportunityEventV31,
    MessageType.analyseWebsiteScreenshotRequestV31,
    MessageType.analyseWebsiteScreenshotResponseV31,
    MessageType.onLogoAnalysisCompleteV31,
    MessageType.preparePhishingReportV22,
    MessageType.preparePhishingReportV28,
    MessageType.preparePhishingReportV32,
]);
function isFrequentlySentMessageType(type) {
    return frequentlySentMessageTypes.has(type);
}

;// CONCATENATED MODULE: ../lib/common/array-utils.ts

function isEmpty(array) {
    return array.length === 0;
}
function first(array) {
    return array[0];
}
function second(array) {
    return array[1];
}
function last(array) {
    return array[array.length - 1];
}
function rest(array) {
    return array.slice(1);
}
function copyArray(array) {
    const identity = (value) => {
        return value;
    };
    return array.map(identity);
}
function isArray(value) {
    return Array.isArray(value);
}
function isWellDefinedArray(array) {
    return !array.some(maybe_none);
}
function newArray(length, value) {
    const array = new Array();
    for (let index = 0; index < length; index += 1) {
        array.push(value);
    }
    return array;
}
function findIndex(array, value) {
    const notFound = -1;
    const index = array.indexOf(value);
    if (index === notFound) {
        return undefined;
    }
    return index;
}
function findAllIndices(array, predicate) {
    const results = new Array();
    array.forEach((element, index) => {
        if (predicate(element)) {
            results.push(index);
        }
    });
    return results;
}
function compareArrays(a, b, compare = isEqual) {
    if (a.length !== b.length) {
        return false;
    }
    const length = a.length;
    for (let i = 0; i < length; i += 1) {
        if (!compare(a[i], b[i])) {
            return false;
        }
    }
    return true;
}
function has(array, value) {
    return maybe_some(findIndex(array, value));
}
function findUnique(array, predicate) {
    const matchingElements = array.filter(predicate);
    if (matchingElements.length !== 1) {
        return undefined;
    }
    return first(matchingElements);
}
function maybeFirst(array) {
    if (none(array)) {
        return undefined;
    }
    return first(array);
}
function deduplicateAndSort(array) {
    return Array.from(new Set(array)).sort();
}

;// CONCATENATED MODULE: ../lib/host/messages.ts





function isSerializedPhishingNavSeqData(value) {
    return isObject(value) &&
        isNumber(value.version) &&
        isNumber(value.builtinRulesPrecedence) &&
        isArray(value.seqs);
}
function isSerializedNewTabPageUrlsV7(value) {
    return isObject(value) &&
        isArray(value.chrome) &&
        isArray(value.firefox) &&
        isArray(value.edge);
}
function isSerializedNewTabPageUrlsV12(value) {
    return isObject(value) &&
        isArray(value.chrome) &&
        isArray(value.firefox) &&
        isArray(value.edge) &&
        isArray(value.edgeChromium);
}
function isSerializedLPSConsumersV13(value) {
    return isArray(value);
}
function isSerializedLPSConsumersV15(value) {
    return isObject(value) &&
        isArray(value.chrome) &&
        isArray(value.firefox) &&
        isArray(value.edgeChromium) &&
        isArray(value.secureBrowser) &&
        isBoolean(value.sbxSecureBrowserMode);
}
;
function isTabMessage(message) {
    return message.tabId !== undefined;
}
function IsIdMessage(message) {
    return message.id !== undefined;
}
class LaunchBrowserRequestV1 {
    constructor(urlSpec, id) {
        this.urlSpec = urlSpec;
        this.id = id;
    }
}
class LaunchBrowserResponseV1 {
    constructor(urlSpec, id, didLaunch) {
        this.urlSpec = urlSpec;
        this.id = id;
        this.didLaunch = didLaunch;
    }
}
class HandshakeV1 {
    constructor(versions) {
        this.versions = versions;
    }
}
class ConfigRequestV1 {
    constructor(phishingSourceSitesVersion, phishingNavigationSequencesVersion, browserInfo) {
        this.phishingSourceSitesVersion = phishingSourceSitesVersion;
        this.phishingNavigationSequencesVersion = phishingNavigationSequencesVersion;
        this.browserInfo = browserInfo;
    }
}
class ExtensibleConfigChangedV1 {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser) {
        this.isEnabled = isEnabled;
        this.blockedPageStrings = blockedPageStrings;
        this.phishingSourceSites = phishingSourceSites;
        this.phishingNavigationSequences = phishingNavigationSequences;
        this.trustedSites = trustedSites;
        this.untrustedSites = untrustedSites;
        this.userTrustedOrigins = userTrustedOrigins;
        this.userUntrustedOrigins = userUntrustedOrigins;
        this.openPhishingLinksInSecureBrowser = openPhishingLinksInSecureBrowser;
    }
}
class ReputationChangedV3 {
    constructor(index, total, reputableSites) {
        this.index = index;
        this.total = total;
        this.reputableSites = reputableSites;
    }
}
class DownloadCreatedV30 {
    constructor(urlSpec, fileSpec) {
        this.urlSpec = urlSpec;
        this.fileSpec = fileSpec;
    }
}
class DownloadCompleteV1 {
    constructor(urlSpec, fileSpec) {
        this.urlSpec = urlSpec;
        this.fileSpec = fileSpec;
    }
}
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["Info"] = 0] = "Info";
    LogLevel[LogLevel["Error"] = 1] = "Error";
})(LogLevel || (LogLevel = {}));
class LogMessageV1 {
    constructor(level, message) {
        this.level = level;
        this.message = message;
    }
}
class HelperErrorV1 {
    constructor(errorType, errorMessage) {
        this.errorType = errorType;
        this.errorMessage = errorMessage;
    }
}
class DormantStateChangedV1 {
    constructor(isDormant) {
        this.isDormant = isDormant;
    }
}
class ExtensionReadyV1 {
    constructor(tabId) {
        this.tabId = tabId;
    }
}
class ExternalAppLinkResponseV1 {
    constructor(navigateToSpec) {
        this.navigateToSpec = navigateToSpec;
    }
}
class AddUserTrustedOriginV1 {
    constructor(origin) {
        this.origin = origin;
    }
}
class AddUserUntrustedOriginV1 {
    constructor(origin) {
        this.origin = origin;
    }
}
class IsFileURLTrustedRequestV1 {
    constructor(id, fileUrlSpec) {
        this.id = id;
        this.fileUrlSpec = fileUrlSpec;
    }
}
class IsFileURLTrustedResponseV1 {
    constructor(id, fileUrlSpec, isTrusted) {
        this.id = id;
        this.fileUrlSpec = fileUrlSpec;
        this.isTrusted = isTrusted;
    }
}
class BlockedFileRequestV1 {
    constructor(fileUrlSpec) {
        this.fileUrlSpec = fileUrlSpec;
    }
}
class BlockedFileResponseV1 {
    constructor(fileUrlSpec, isTrusted) {
        this.fileUrlSpec = fileUrlSpec;
        this.isTrusted = isTrusted;
    }
}
class PopupDataRequestV1 {
    constructor() { }
}
class ClearRememberedDecisionsV1 {
    constructor() { }
}
class EnabledFeaturesRequestV2 {
    constructor(id, respondImmediately) {
        this.id = id;
        this.respondImmediately = respondImmediately;
    }
}
class EnabledFeaturesResponseV2 {
    constructor(id, linkProtection, fileURLProtection, pdfProtection, downloadProtection) {
        this.id = id;
        this.linkProtection = linkProtection;
        this.fileURLProtection = fileURLProtection;
        this.pdfProtection = pdfProtection;
        this.downloadProtection = downloadProtection;
    }
}
var RememberedOriginTypes;
(function (RememberedOriginTypes) {
    RememberedOriginTypes[RememberedOriginTypes["Trusted"] = 0] = "Trusted";
    RememberedOriginTypes[RememberedOriginTypes["Untrusted"] = 1] = "Untrusted";
})(RememberedOriginTypes || (RememberedOriginTypes = {}));
class ClearRememberedOriginV3 {
    constructor(origin, type) {
        this.origin = origin;
        this.type = type;
    }
}
class ExtensibleConfigChangedV3 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV1)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser);
        this.prioritiseTrustedSites = prioritiseTrustedSites;
    }
}
class ExtensibleConfigChangedV4 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV3)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites);
        this.promptForUncategorized = promptForUncategorized;
    }
}
class ExtensibleConfigChangedV5 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV4)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized);
        this.isEnterpriseProduct = isEnterpriseProduct;
    }
}
class ExtensibleConfigChangedV7 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV5)) {
    constructor(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, newTabPageUrls) {
        super(isEnabled, blockedPageStrings, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct);
        this.newTabPageUrls = newTabPageUrls;
    }
}
class TrustUrlV8 {
    constructor(navigateToUrlSpec, blockedUrlSpec, trustUrl, rememberDecision, contentType) {
        this.navigateToUrlSpec = navigateToUrlSpec;
        this.blockedUrlSpec = blockedUrlSpec;
        this.trustUrl = trustUrl;
        this.rememberDecision = rememberDecision;
        this.contentType = contentType;
    }
}
class ExtensibleConfigChangedV8 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV7)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL) {
        super(isEnabled, undefined, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, newTabPageUrls);
        this.isConsumerProduct = isConsumerProduct;
        this.blockedPageLearnMoreURL = blockedPageLearnMoreURL;
    }
}
class ExtensibleConfigChangedV9 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV8)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL);
        this.dontAskAgain = dontAskAgain;
    }
}
class HeartbeatV10 {
    constructor(id) {
        this.id = id;
    }
}
var SureClickStatus;
(function (SureClickStatus) {
    SureClickStatus[SureClickStatus["Enabled"] = 0] = "Enabled";
    SureClickStatus[SureClickStatus["Disabled"] = 1] = "Disabled";
    SureClickStatus[SureClickStatus["InitRequired"] = 2] = "InitRequired";
    SureClickStatus[SureClickStatus["Unlicensed"] = 3] = "Unlicensed";
    SureClickStatus[SureClickStatus["Unknown"] = 4] = "Unknown";
})(SureClickStatus || (SureClickStatus = {}));
class ExtensibleConfigChangedV11 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV9)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, productStatus) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain);
        this.secureBrowserRedirectTrustedSites = secureBrowserRedirectTrustedSites;
        this.productStatus = productStatus;
    }
}
class ExtensibleConfigChangedV12 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV11)) {
}
class ExtensibleConfigChangedV13 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV12)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus);
        this.linkProtectionServiceConsumers = linkProtectionServiceConsumers;
    }
}
class ExtensibleConfigChangedV14 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV13)) {
}
class ExtensibleConfigChangedV15 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV14)) {
}
class ExternalAppLinkRequestV16 {
    constructor(linkSpec, externalAppName, vmid) {
        this.linkSpec = linkSpec;
        this.externalAppName = externalAppName;
        this.vmid = vmid;
    }
}
class ExtensibleConfigChangedV17 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV15)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, isEnterpriseProduct, isConsumerProduct, newTabPageUrls, blockedPageLearnMoreURL, dontAskAgain, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers);
        this.closeLaunchedPageTabs = closeLaunchedPageTabs;
    }
}
var ProductTypes;
(function (ProductTypes) {
    ProductTypes[ProductTypes["Unknown"] = 0] = "Unknown";
    ProductTypes[ProductTypes["LegacyEnterprise"] = 1] = "LegacyEnterprise";
    ProductTypes[ProductTypes["LegacyOther"] = 2] = "LegacyOther";
    ProductTypes[ProductTypes["DaaS"] = 3] = "DaaS";
    ProductTypes[ProductTypes["Unbundled"] = 4] = "Unbundled";
    ProductTypes[ProductTypes["Kodiak"] = 5] = "Kodiak";
    ProductTypes[ProductTypes["Foundation"] = 6] = "Foundation";
})(ProductTypes || (ProductTypes = {}));
class ExtensibleConfigChangedV19 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV17)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, undefined, undefined, newTabPageUrls, blockedPageLearnMoreURL, undefined, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs);
        this.isHPConsumerMachine = isHPConsumerMachine;
        this.productType = productType;
    }
}
class ExtensibleConfigChangedV20 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV19)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType);
        this.intranetSites = intranetSites;
    }
}
class ExtensibleConfigChangedV21 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV20)) {
}
class PhishingDetectionTrippedV22 {
    constructor() { }
}
class PhishingDetectionSuppressedV22 {
    constructor() { }
}
class PhishingInformationSubmittedV22 {
    constructor() { }
}
class FrameLoadResponseV22 {
    constructor(frameId, linkProtectionWouldBlock, ipEnabled, ipConfig) {
        this.frameId = frameId;
        this.linkProtectionWouldBlock = linkProtectionWouldBlock;
        this.ipEnabled = ipEnabled;
        this.ipConfig = ipConfig;
    }
}
class ContentScriptDataV22 {
    constructor(linkProtectionWouldBlock, ipEnabled, ipConfig) {
        this.linkProtectionWouldBlock = linkProtectionWouldBlock;
        this.ipEnabled = ipEnabled;
        this.ipConfig = ipConfig;
    }
}
class OnFrameDomUpdateV22 {
    constructor(hasInterestingInput, hasCategory) {
        this.hasInterestingInput = hasInterestingInput;
        this.hasCategory = hasCategory;
    }
}
class FreezeScreenshotV22 {
    constructor() { }
}
class OnOverlayClickV22 {
    constructor(action) {
        this.action = action;
    }
}
class OnPhishingCategoryChangedV22 {
    constructor(category, canonicalBlockingSource) {
        this.category = category;
        this.canonicalBlockingSource = canonicalBlockingSource;
    }
    ;
}
class PhishingCategoryRequestV22 {
    constructor(id, url) {
        this.id = id;
        this.url = url;
    }
}
class PhishingCategoryResponseV22 {
    constructor(id, category) {
        this.id = id;
        this.category = category;
    }
}
class PhishingHostStatusChangeV22 {
    constructor(hostnames, allowInput) {
        this.hostnames = hostnames;
        this.allowInput = allowInput;
    }
}
class PreparePhishingReportV22 {
    constructor(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, tabActivities, annotations) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.cloudListVersion = cloudListVersion;
        this.alertType = alertType;
        this.url = url;
        this.screenshotBase64 = screenshotBase64;
        this.tabActivities = tabActivities;
        this.annotations = annotations;
    }
}
class PreparePhishingReportV28 {
    constructor(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, tabActivities, annotations) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.cloudListVersion = cloudListVersion;
        this.alertType = alertType;
        this.url = url;
        this.screenshotBase64 = screenshotBase64;
        this.statusCode = statusCode;
        this.statusMsg = statusMsg;
        this.domainAgeDays = domainAgeDays;
        this.domainAgeDaysThreshold = domainAgeDaysThreshold;
        this.tabActivities = tabActivities;
        this.annotations = annotations;
    }
}
class PreparePhishingReportV32 extends PreparePhishingReportV28 {
    constructor(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, tabActivities, annotations, logoAnalysis) {
        super(tabId, timestamp, extensionId, extensionVersion, cloudListVersion, alertType, url, screenshotBase64, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, tabActivities, annotations);
        this.logoAnalysis = logoAnalysis;
    }
}
class AddPhishingReportActionV22 {
    constructor(tabId, action) {
        this.tabId = tabId;
        this.action = action;
    }
}
class SendPhishingReportV22 {
    constructor(tabId) {
        this.tabId = tabId;
    }
}
class OptionsDataResponseV22 {
    constructor(ipShowList, ipUserAllowedHosts) {
        this.ipShowList = ipShowList;
        this.ipUserAllowedHosts = ipUserAllowedHosts;
    }
}
class ExtensibleConfigChangedV22 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV21)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, linkProtectionServiceConsumers, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites);
        this.identityProtection = identityProtection;
    }
}
class ExtensibleConfigChangedV23 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV22)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, undefined, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection);
    }
}
class IdentityProtectionRunningV24 {
    constructor(running) {
        this.running = running;
    }
}
class ExtensibleConfigChangedV24 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV23)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection);
        this.ipIsSureClick = ipIsSureClick;
    }
}
class PopupDataResponseV25 {
    constructor(popupMessage, showClearRememberedDecisionsInfo, showSecureBrowserWindowButton, productType, helpLinkURL) {
        this.popupMessage = popupMessage;
        this.showClearRememberedDecisionsInfo = showClearRememberedDecisionsInfo;
        this.showSecureBrowserWindowButton = showSecureBrowserWindowButton;
        this.productType = productType;
        this.helpLinkURL = helpLinkURL;
    }
}
class ShowUrlFilteringOverlayV26 {
    constructor(blockingCategories) {
        this.blockingCategories = blockingCategories;
    }
}
class ShowDomainAgeUrlFilteringOverlayV28 {
    constructor(domainAgeDays) {
        this.domainAgeDays = domainAgeDays;
    }
}
class ShowStatusMsgUrlFilteringOverlayV29 {
    constructor(statusMsg) {
        this.statusMsg = statusMsg;
    }
}
class MakeUrlFilteringAlertV26 {
    constructor(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, tabActivities) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.url = url;
        this.blockingCategories = blockingCategories;
        this.tabActivities = tabActivities;
    }
}
class MakeUrlFilteringAlertV27 {
    constructor(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, statusCode, statusMsg, overridden, tabActivities) {
        this.tabId = tabId;
        this.timestamp = timestamp;
        this.extensionId = extensionId;
        this.extensionVersion = extensionVersion;
        this.url = url;
        this.blockingCategories = blockingCategories;
        this.statusCode = statusCode;
        this.statusMsg = statusMsg;
        this.overridden = overridden;
        this.tabActivities = tabActivities;
    }
}
class MakeUrlFilteringAlertV28 extends MakeUrlFilteringAlertV27 {
    constructor(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, statusCode, statusMsg, overridden, tabActivities, domainAgeDays, domainAgeDaysThreshold, alertType) {
        super(tabId, timestamp, extensionId, extensionVersion, url, blockingCategories, statusCode, statusMsg, overridden, tabActivities);
        this.domainAgeDays = domainAgeDays;
        this.domainAgeDaysThreshold = domainAgeDaysThreshold;
        this.alertType = alertType;
    }
}
class ExtensibleConfigChangedV26 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV24)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick);
        this.ufBlockedCategories = ufBlockedCategories;
    }
}
class ExtensibleConfigChangedV28 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV26)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories, ufDomainAgeCheckEnabled, ufDomainAgeCheckMinDays) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories);
        this.ufDomainAgeCheckEnabled = ufDomainAgeCheckEnabled;
        this.ufDomainAgeCheckMinDays = ufDomainAgeCheckMinDays;
    }
}
class ExtensibleConfigChangedV29 extends (/* unused pure expression or super */ null && (ExtensibleConfigChangedV28)) {
    constructor(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories, ufDomainAgeCheckEnabled, ufDomainAgeCheckMinDays, ufStatusCodeCheckEnabled) {
        super(isEnabled, phishingSourceSites, phishingNavigationSequences, trustedSites, untrustedSites, userTrustedOrigins, userUntrustedOrigins, openPhishingLinksInSecureBrowser, prioritiseTrustedSites, promptForUncategorized, newTabPageUrls, blockedPageLearnMoreURL, secureBrowserRedirectTrustedSites, sureClickStatus, closeLaunchedPageTabs, isHPConsumerMachine, productType, intranetSites, identityProtection, ipIsSureClick, ufBlockedCategories, ufDomainAgeCheckEnabled, ufDomainAgeCheckMinDays);
        this.ufStatusCodeCheckEnabled = ufStatusCodeCheckEnabled;
    }
}
class AnalyseWebsiteScreenshotOpportunityEventV31 {
    constructor(important) {
        this.important = important;
    }
}
var LogoAnalysisResultTypes;
(function (LogoAnalysisResultTypes) {
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["Failure"] = 0] = "Failure";
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["NoLogoFound"] = 1] = "NoLogoFound";
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["UnknownLogoFound"] = 2] = "UnknownLogoFound";
    LogoAnalysisResultTypes[LogoAnalysisResultTypes["KnownLogoFound"] = 3] = "KnownLogoFound";
})(LogoAnalysisResultTypes || (LogoAnalysisResultTypes = {}));
class AnalyseWebsiteScreenshotRequestV31 {
    constructor(id, url, screenshotBase64) {
        this.id = id;
        this.url = url;
        this.screenshotBase64 = screenshotBase64;
    }
}
class AnalyseWebsiteScreenshotResponseV31 {
    constructor(id, result, url, identifiedBrandLogos) {
        this.id = id;
        this.result = result;
        this.url = url;
        this.identifiedBrandLogos = identifiedBrandLogos;
    }
}
class OnLogoAnalysisCompleteV31 {
    constructor(logoFound, protectedLogoFound, protectedBrandLogo) {
        this.logoFound = logoFound;
        this.protectedLogoFound = protectedLogoFound;
        this.protectedBrandLogo = protectedBrandLogo;
    }
}
class Message {
    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
    }
}
function messageToString(message) {
    return string_utils_toString(message);
}

;// CONCATENATED MODULE: ../lib/common/file-url-tracker.ts




function makeIsFileUrlTrustedRequestHandler(messageRouter, messageSender) {
    const makeRequest = (id, fileUrl) => {
        return new IsFileURLTrustedRequestV1(id, URLToString(fileUrl));
    };
    const readResponse = (response) => {
        const id = response.id;
        const isTrusted = response.isTrusted;
        return [id, isTrusted];
    };
    return new RequestResponseHandler(MessageType.isFileURLTrustedRequestV1, MessageType.isFileURLTrustedResponseV1, makeRequest, readResponse, messageRouter, messageSender);
}
class FileUrlTracker {
    constructor(messageRouter, messageSender) {
        this.trustedFileUrls = makeUrlHashSet(UrlCompareOptions.IgnoreSearchParams);
        this.untrustedFileUrls = makeUrlHashSet(UrlCompareOptions.IgnoreSearchParams);
        this.requestHandler = makeIsFileUrlTrustedRequestHandler(messageRouter, messageSender);
    }
    isFileUrlTrusted(fileUrl) {
        if (!isFileUrl(fileUrl)) {
            return undefined;
        }
        if (this.untrustedFileUrls.has(fileUrl)) {
            return false;
        }
        if (this.trustedFileUrls.has(fileUrl)) {
            return true;
        }
        return undefined;
    }
    queryFileUrlTrustedness(fileUrl, onQueryComplete) {
        if (!isFileUrl(fileUrl)) {
            return false;
        }
        this.requestHandler.sendRequest(fileUrl, (fileUrl, isTrusted) => {
            this.untrustedFileUrls.remove(fileUrl);
            this.trustedFileUrls.remove(fileUrl);
            if (isTrusted) {
                this.trustedFileUrls.add(fileUrl);
            }
            else {
                this.untrustedFileUrls.add(fileUrl);
            }
            onQueryComplete(fileUrl, isTrusted);
        });
        return true;
    }
}

;// CONCATENATED MODULE: ../lib/common/range.ts

class Range {
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }
    contains(value) {
        return isInRange(value, this.min, this.max);
    }
}

;// CONCATENATED MODULE: ../lib/host/protocol-versions.ts




var ProtocolVersion;
(function (ProtocolVersion) {
    ProtocolVersion["v1"] = "tag:bromium.com,2018-02:protocols:google-chrome-extension:initial";
    ProtocolVersion["v2"] = "tag:bromium.com,2018-06:protocols:google-chrome-extension:v2";
    ProtocolVersion["v3"] = "tag:bromium.com,2018-07:protocols:google-chrome-extension:v3";
    ProtocolVersion["v4"] = "tag:bromium.com,2018-08:protocols:google-chrome-extension:v4";
    ProtocolVersion["v5"] = "tag:bromium.com,2018-11:protocols:google-chrome-extension:v5";
    ProtocolVersion["v6"] = "tag:bromium.com,2018-12:protocols:google-chrome-extension:v6";
    ProtocolVersion["v7"] = "tag:bromium.com,2019-01:protocols:google-chrome-extension:v7";
    ProtocolVersion["v8"] = "tag:bromium.com,2019-06:protocols:google-chrome-extension:v8";
    ProtocolVersion["v9"] = "tag:bromium.com,2019-07:protocols:google-chrome-extension:v9";
    ProtocolVersion["v10"] = "tag:bromium.com,2019-09:protocols:google-chrome-extension:v10";
    ProtocolVersion["v11"] = "tag:bromium.com,2019-10:protocols:google-chrome-extension:v11";
    ProtocolVersion["v12"] = "tag:bromium.com,2019-11:protocols:google-chrome-extension:v12";
    ProtocolVersion["v13"] = "tag:bromium.com,2019-12:protocols:google-chrome-extension:v13";
    ProtocolVersion["v14"] = "tag:bromium.com,2020-01:protocols:google-chrome-extension:v14";
    ProtocolVersion["v15"] = "tag:bromium.com,2020-02:protocols:google-chrome-extension:v15";
    ProtocolVersion["v16"] = "tag:bromium.com,2020-02:protocols:google-chrome-extension:v16";
    ProtocolVersion["v17"] = "tag:bromium.com,2020-04:protocols:google-chrome-extension:v17";
    ProtocolVersion["v18"] = "tag:bromium.com,2020-05:protocols:google-chrome-extension:v18";
    ProtocolVersion["v19"] = "tag:bromium.com,2020-05:protocols:google-chrome-extension:v19";
    ProtocolVersion["v20"] = "tag:SBX,2020-10:v20";
    ProtocolVersion["v21"] = "tag:SBX,2020-11:v21";
    ProtocolVersion["v22"] = "tag:SBX+IP,2020-11:v22";
    ProtocolVersion["v23"] = "tag:SBX+IP,2021-03:v23";
    ProtocolVersion["v24"] = "tag:SBX+IP,2021-07:v24";
    ProtocolVersion["v25"] = "tag:SBX+IP,2021-10:v25";
    ProtocolVersion["v26"] = "tag:SBX+IP+UF,2023-01:v26";
    ProtocolVersion["v27"] = "tag:SBX+IP+UF,2023-07:v27";
    ProtocolVersion["v28"] = "tag:SBX+IP+UF,2023-10:v28";
    ProtocolVersion["v29"] = "tag:SBX+IP+UF,2024-03:v29";
    ProtocolVersion["v30"] = "tag:SBX+IP+UF,2024-05:v30";
    ProtocolVersion["v31"] = "tag:SBX+IP+UF,2024-10:v31";
    ProtocolVersion["v32"] = "tag:SBX+IP+UF+AI,2024-11:v32";
    ProtocolVersion["v33"] = "tag:SBX+IP+UF+AI,2025-02:v33";
})(ProtocolVersion || (ProtocolVersion = {}));
const supportedProtocolVersions = [
    ProtocolVersion.v33,
    ProtocolVersion.v32,
    ProtocolVersion.v31,
    ProtocolVersion.v30,
    ProtocolVersion.v29,
    ProtocolVersion.v28,
    ProtocolVersion.v27,
    ProtocolVersion.v26,
    ProtocolVersion.v25,
    ProtocolVersion.v24,
    ProtocolVersion.v23,
    ProtocolVersion.v22,
    ProtocolVersion.v21,
    ProtocolVersion.v20,
    ProtocolVersion.v19,
    ProtocolVersion.v18,
    ProtocolVersion.v17,
    ProtocolVersion.v16,
    ProtocolVersion.v15,
    ProtocolVersion.v14,
    ProtocolVersion.v13,
    ProtocolVersion.v12,
    ProtocolVersion.v11,
    ProtocolVersion.v10,
    ProtocolVersion.v9,
    ProtocolVersion.v8,
    ProtocolVersion.v7,
    ProtocolVersion.v6,
    ProtocolVersion.v5,
    ProtocolVersion.v4,
    ProtocolVersion.v3,
    ProtocolVersion.v2,
    ProtocolVersion.v1
];
const supportedMessageTypes = (() => {
    const supportedMessageRanges = makeStringHashMap();
    supportedMessageRanges.putMany([
        [ProtocolVersion.v1, new Range(MessageType.handshakeV1, MessageType.heartbeatV1)],
        [ProtocolVersion.v2, new Range(MessageType.handshakeV1, MessageType.enabledFeaturesResponseV2)],
        [ProtocolVersion.v3, new Range(MessageType.handshakeV1, MessageType.reputationChangedV3)],
        [ProtocolVersion.v4, new Range(MessageType.handshakeV1, MessageType.blockedPageDataResponseV4)],
        [ProtocolVersion.v5, new Range(MessageType.handshakeV1, MessageType.popupDataResponseV5)],
        [ProtocolVersion.v6, new Range(MessageType.handshakeV1, MessageType.trustUrlV6)],
        [ProtocolVersion.v7, new Range(MessageType.handshakeV1, MessageType.configChangedV7)],
        [ProtocolVersion.v8, new Range(MessageType.handshakeV1, MessageType.configChangedV8)],
        [ProtocolVersion.v9, new Range(MessageType.handshakeV1, MessageType.configChangedV9)],
        [ProtocolVersion.v10, new Range(MessageType.handshakeV1, MessageType.heartbeatV10)],
        [ProtocolVersion.v11, new Range(MessageType.handshakeV1, MessageType.configChangedV11)],
        [ProtocolVersion.v12, new Range(MessageType.handshakeV1, MessageType.configChangedV12)],
        [ProtocolVersion.v13, new Range(MessageType.handshakeV1, MessageType.configChangedV13)],
        [ProtocolVersion.v14, new Range(MessageType.handshakeV1, MessageType.configChangedV14)],
        [ProtocolVersion.v15, new Range(MessageType.handshakeV1, MessageType.configChangedV15)],
        [ProtocolVersion.v16, new Range(MessageType.handshakeV1, MessageType.externalAppLinkRequestV16)],
        [ProtocolVersion.v17, new Range(MessageType.handshakeV1, MessageType.configChangedV17)],
        [ProtocolVersion.v18, new Range(MessageType.handshakeV1, MessageType.popupDataResponseV18)],
        [ProtocolVersion.v19, new Range(MessageType.handshakeV1, MessageType.configChangedV19)],
        [ProtocolVersion.v20, new Range(MessageType.handshakeV1, MessageType.configChangedV20)],
        [ProtocolVersion.v21, new Range(MessageType.handshakeV1, MessageType.configChangedV21)],
        [ProtocolVersion.v22, new Range(MessageType.handshakeV1, MessageType.configChangedV22)],
        [ProtocolVersion.v23, new Range(MessageType.handshakeV1, MessageType.configChangedV23)],
        [ProtocolVersion.v24, new Range(MessageType.handshakeV1, MessageType.configChangedV24)],
        [ProtocolVersion.v25, new Range(MessageType.handshakeV1, MessageType.popupDataResponseV25)],
        [ProtocolVersion.v26, new Range(MessageType.handshakeV1, MessageType.configChangedV26)],
        [ProtocolVersion.v27, new Range(MessageType.handshakeV1, MessageType.makeUrlFilteringAlertV27)],
        [ProtocolVersion.v28, new Range(MessageType.handshakeV1, MessageType.makeUrlFilteringAlertV28)],
        [ProtocolVersion.v29, new Range(MessageType.handshakeV1, MessageType.showStatusMsgUrlFilteringOverlayV29)],
        [ProtocolVersion.v30, new Range(MessageType.handshakeV1, MessageType.downloadCreatedV30)],
        [ProtocolVersion.v31, new Range(MessageType.handshakeV1, MessageType.onLogoAnalysisCompleteV31)],
        [ProtocolVersion.v32, new Range(MessageType.handshakeV1, MessageType.preparePhishingReportV32)],
        [ProtocolVersion.v33, new Range(MessageType.handshakeV1, MessageType.configChangedV33)],
    ]);
    return supportedMessageRanges;
})();
function isSupported(rangeMap, value, version) {
    if (maybe_none(version)) {
        return false;
    }
    const range = rangeMap.get(version);
    if (maybe_none(range)) {
        return false;
    }
    return range.contains(value);
}
function isMessageTypeSupported(messageType, protocolVersion) {
    return isSupported(supportedMessageTypes, messageType, protocolVersion);
}
function shouldLogMessage(protocolVersion) {
    return !isMessageTypeSupported(MessageType.heartbeatV10, protocolVersion);
}
var HelpPageVersion;
(function (HelpPageVersion) {
    HelpPageVersion["v415"] = "v4.1.5";
    HelpPageVersion["v4181"] = "v4.1.8.1";
    HelpPageVersion["v430"] = "v4.3.0";
    HelpPageVersion["v435"] = "v4.3.5";
    HelpPageVersion["maxHelpPageVersion"] = "v4.3.5";
})(HelpPageVersion || (HelpPageVersion = {}));
;
const supportedHelpPageVersions = (() => {
    const supportedHelpPageVersions = makeStringHashMap();
    supportedHelpPageVersions.putMany([
        [ProtocolVersion.v1, HelpPageVersion.v415],
        [ProtocolVersion.v2, HelpPageVersion.v415],
        [ProtocolVersion.v3, HelpPageVersion.v415],
        [ProtocolVersion.v4, HelpPageVersion.v415],
        [ProtocolVersion.v5, HelpPageVersion.v415],
        [ProtocolVersion.v6, HelpPageVersion.v415],
        [ProtocolVersion.v7, HelpPageVersion.v415],
        [ProtocolVersion.v8, HelpPageVersion.v415],
        [ProtocolVersion.v9, HelpPageVersion.v415],
        [ProtocolVersion.v10, HelpPageVersion.v415],
        [ProtocolVersion.v11, HelpPageVersion.v4181],
        [ProtocolVersion.v12, HelpPageVersion.v4181],
        [ProtocolVersion.v13, HelpPageVersion.v4181],
        [ProtocolVersion.v14, HelpPageVersion.v4181],
        [ProtocolVersion.v15, HelpPageVersion.v4181],
        [ProtocolVersion.v16, HelpPageVersion.v4181],
        [ProtocolVersion.v17, HelpPageVersion.v4181],
        [ProtocolVersion.v18, HelpPageVersion.v4181],
        [ProtocolVersion.v19, HelpPageVersion.v4181],
        [ProtocolVersion.v20, HelpPageVersion.v4181],
        [ProtocolVersion.v21, HelpPageVersion.v4181],
        [ProtocolVersion.v22, HelpPageVersion.v430],
        [ProtocolVersion.v23, HelpPageVersion.v430],
        [ProtocolVersion.v24, HelpPageVersion.v435],
        [ProtocolVersion.v25, HelpPageVersion.v435],
        [ProtocolVersion.v26, HelpPageVersion.v435],
        [ProtocolVersion.v27, HelpPageVersion.v435],
        [ProtocolVersion.v28, HelpPageVersion.v435],
        [ProtocolVersion.v29, HelpPageVersion.v435],
        [ProtocolVersion.v30, HelpPageVersion.v435],
        [ProtocolVersion.v31, HelpPageVersion.v435],
        [ProtocolVersion.v33, HelpPageVersion.v435],
    ]);
    return supportedHelpPageVersions;
})();
function getHelpPageVersion(protocolVersion) {
    if (maybe_some(protocolVersion)) {
        const supportedVersion = supportedHelpPageVersions.get(protocolVersion);
        if (maybe_some(supportedVersion)) {
            return supportedVersion;
        }
    }
    return HelpPageVersion.maxHelpPageVersion;
}

;// CONCATENATED MODULE: ../lib/common/errors.ts

var ChragError;
(function (ChragError) {
    ChragError[ChragError["notEnabled"] = 0] = "notEnabled";
    ChragError[ChragError["helperPortError"] = 1] = "helperPortError";
    ChragError[ChragError["launchBrowserFailed"] = 2] = "launchBrowserFailed";
    ChragError[ChragError["trustDownloadFailed"] = 3] = "trustDownloadFailed";
    ChragError[ChragError["handshakeError"] = 4] = "handshakeError";
    ChragError[ChragError["unknownError"] = 5] = "unknownError";
    ChragError[ChragError["recoveredFromError"] = 6] = "recoveredFromError";
    ChragError[ChragError["is32bitFirefox"] = 7] = "is32bitFirefox";
    ChragError[ChragError["helperUnresponsive"] = 8] = "helperUnresponsive";
})(ChragError || (ChragError = {}));
var ChragErrorLimits;
(function (ChragErrorLimits) {
    ChragErrorLimits[ChragErrorLimits["min"] = 0] = "min";
    ChragErrorLimits[ChragErrorLimits["max"] = 8] = "max";
})(ChragErrorLimits || (ChragErrorLimits = {}));
function isChragError(type) {
    return isInRange(type, ChragErrorLimits.min, ChragErrorLimits.max);
}
function errors_isError(value) {
    return value instanceof Error;
}

;// CONCATENATED MODULE: ../lib/common/heartbeat.ts







const oneMinute = 60000;
class HeartbeatController {
    constructor(errorHandler, messageSender, messageRouter, handshaker) {
        this.errorHandler = errorHandler;
        this.messageSender = messageSender;
        this.consecutiveHeartbeatMisses = 0;
        this.timeoutId = undefined;
        this.pendingHeartbeat = undefined;
        this.idGenerator = new IdGenerator();
        messageRouter.registerMessagePayloadHandler(MessageType.heartbeatV10, (message) => this.onHeartbeatReceived(message));
        handshaker.onHandshaken.registerEventHandler((event) => {
            if (isMessageTypeSupported(MessageType.heartbeatV10, event.negotiatedVersion)) {
                setTimeout(() => this.sendHeartbeat(), oneMinute);
            }
        });
    }
    onHeartbeatReceived(heartbeat) {
        if (maybe_some(this.pendingHeartbeat) && this.pendingHeartbeat === heartbeat.id) {
            this.resetPendingHeartbeat();
        }
    }
    sendHeartbeat() {
        this.resetPendingHeartbeat();
        this.cancelTimeout();
        const id = this.idGenerator.generateId();
        this.messageSender.sendMessage(MessageType.heartbeatV10, new HeartbeatV10(id));
        try {
            this.timeoutId = setTimeout(() => {
                if (maybe_some(this.pendingHeartbeat)) {
                    if (this.consecutiveHeartbeatMisses < 4) {
                        this.consecutiveHeartbeatMisses += 1;
                        log_log(`We missed a heartbeat response (${this.consecutiveHeartbeatMisses} consecutive misses)`);
                        this.sendHeartbeat();
                    }
                    else {
                        this.consecutiveHeartbeatMisses = 0;
                        this.resetPendingHeartbeat();
                        this.errorHandler.raiseError(ChragError.helperUnresponsive);
                    }
                }
                else {
                    this.consecutiveHeartbeatMisses = 0;
                    this.sendHeartbeat();
                }
            }, oneMinute);
        }
        finally {
            this.pendingHeartbeat = id;
        }
    }
    resetPendingHeartbeat() {
        if (maybe_none(this.pendingHeartbeat)) {
            return;
        }
        this.pendingHeartbeat = undefined;
    }
    cancelTimeout() {
        if (maybe_none(this.timeoutId)) {
            return;
        }
        try {
            clearTimeout(this.timeoutId);
        }
        finally {
            this.timeoutId = undefined;
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/logger.ts





class MessagingLogSink {
    constructor(sendMessage) {
        this.sendMessage = sendMessage;
        this.isSendingLogMessage = false;
    }
    log(message, level = LogLevel.Info) {
        if (this.isSendingLogMessage) {
            return;
        }
        this.isSendingLogMessage = true;
        try {
            this.sendMessage(MessageType.logMessageV1, { level, message });
        }
        catch (e) {
        }
        finally {
            this.isSendingLogMessage = false;
        }
    }
    logError(message) {
        this.log(message, LogLevel.Error);
    }
}
class HelperLogSink extends MessagingLogSink {
    constructor(sender) {
        super((type, payload) => sender.sendMessage(type, payload));
    }
}
class ScriptLogSink extends (/* unused pure expression or super */ null && (MessagingLogSink)) {
    constructor(extensionPortController) {
        super((type, payload) => extensionPortController.sendMessage(type, payload));
    }
}
class MessageLogger {
    constructor(messageDecoder, handshaker) {
        this.protocolVersion = undefined;
        handshaker.onHandshaken.registerEventHandler((event) => {
            this.protocolVersion = event.negotiatedVersion;
        });
        messageDecoder.onMessageDecoded.registerEventHandler((event) => {
            const message = event.message;
            if (!isFrequentlySentMessageType(message.type)) {
                this.log(`MessageLogger.onMessageReceived: message: ${messageToString(message)}`);
            }
        });
    }
    log(message) {
        if (maybe_some(this.protocolVersion) && shouldLogMessage(this.protocolVersion)) {
            log_log(message);
        }
        else {
            console.log(message);
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/message-decoder.ts


function decodeMessage(encodedMessage) {
    let message = encodedMessage;
    if (message.type === undefined) {
        message = JSON.parse(encodedMessage.toString());
        if (message.type === undefined) {
            return undefined;
        }
    }
    if (!isNumber(message.type)) {
        return undefined;
    }
    if (!isMessageType(message.type)) {
        return undefined;
    }
    return message;
}
class MessageDecodedEvent {
    constructor(message) {
        this.message = message;
    }
}

;// CONCATENATED MODULE: ../lib/common/message-router.ts




function handleInvalidMessage(port, invalidMessage) {
    logError(`handleInvalidMessage: invalidMessage: ${string_utils_toString(invalidMessage)}`);
}
function onUnhandledMessage(port, message) {
    logError(`onUnhandledMessage: message: ${string_utils_toString(message)}`);
}
class MessageRouter {
    constructor(handleInvalidMessage, onUnhandledMessage) {
        this.handleInvalidMessage = handleInvalidMessage;
        this.onUnhandledMessage = onUnhandledMessage;
        this.messageHandlers = new Map();
    }
    registerMessagePayloadHandler(type, handlePayload) {
        this.registerMessageHandler(type, message => handlePayload(message.payload));
    }
    registerMessageHandler(type, handleMessage) {
        const messageHandlers = this.messageHandlers.get(type);
        if (messageHandlers === undefined) {
            this.messageHandlers.set(type, [handleMessage]);
        }
        else {
            messageHandlers.push(handleMessage);
        }
    }
    registerManyMessageHandler(types, handleMessage) {
        for (const type of types) {
            this.registerMessageHandler(type, handleMessage);
        }
    }
}
class GenericMessageRouter extends MessageRouter {
    constructor() {
        super(handleInvalidMessage, onUnhandledMessage);
        this.onMessageDecoded = new EventDispatcher();
    }
    onMessageReceived(port, encodedMessage) {
        let message = decodeMessage(encodedMessage);
        if (message === undefined) {
            this.handleInvalidMessage(port, encodedMessage);
            return;
        }
        this.onMessageDecoded.dispatchEvent(new MessageDecodedEvent(message));
        const messageHandlers = this.messageHandlers.get(message.type);
        if (messageHandlers === undefined) {
            this.onUnhandledMessage(port, message);
            return;
        }
        for (const handleMessage of messageHandlers) {
            handleMessage(message);
        }
    }
    tryRouteMessage(message) {
        const messageHandlers = this.messageHandlers.get(message.type);
        if (messageHandlers !== undefined) {
            for (const handleMessage of messageHandlers) {
                handleMessage(message);
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/on-configured.ts



class OnConfiguredManager {
    constructor() {
        this.onConfigured = doOnce(() => {
            this.configured = true;
            log_log("OnConfiguredManager: SBX is fully configured");
            this.onConfiguredDispatcher.setCondition();
        });
        this.onConfiguredDispatcher = new ConditionDispatcher();
        this.configured = false;
    }
    registerListener(listener) {
        this.onConfiguredDispatcher.registerConditionListener(listener);
    }
    get isConfigured() {
        return this.configured;
    }
}
class DummyOnConfigured {
    constructor() {
        this.isConfigured = true;
    }
    registerListener(listener) {
        listener();
    }
}

;// CONCATENATED MODULE: ../lib/common/identity-protection-common.ts


var IPPageCategory;
(function (IPPageCategory) {
    IPPageCategory[IPPageCategory["Allowed"] = 0] = "Allowed";
    IPPageCategory[IPPageCategory["Blocked"] = 1] = "Blocked";
    IPPageCategory[IPPageCategory["Unknown"] = 2] = "Unknown";
    IPPageCategory[IPPageCategory["UserAllowed"] = 3] = "UserAllowed";
})(IPPageCategory || (IPPageCategory = {}));
function isGoodCategory(category) {
    return category === IPPageCategory.Allowed || category === IPPageCategory.UserAllowed;
}
var IPOperationMode;
(function (IPOperationMode) {
    IPOperationMode[IPOperationMode["Normal"] = 0] = "Normal";
    IPOperationMode[IPOperationMode["BlockedFullReporting"] = 1] = "BlockedFullReporting";
    IPOperationMode[IPOperationMode["Learning"] = 2] = "Learning";
    IPOperationMode[IPOperationMode["PhishingProtection"] = 3] = "PhishingProtection";
    IPOperationMode[IPOperationMode["BlockedOnly"] = 4] = "BlockedOnly";
    IPOperationMode[IPOperationMode["Reserved5"] = 5] = "Reserved5";
    IPOperationMode[IPOperationMode["Reserved6"] = 6] = "Reserved6";
    IPOperationMode[IPOperationMode["Reserved7"] = 7] = "Reserved7";
    IPOperationMode[IPOperationMode["Reserved8"] = 8] = "Reserved8";
    IPOperationMode[IPOperationMode["Reserved9"] = 9] = "Reserved9";
    IPOperationMode[IPOperationMode["Reserved10"] = 10] = "Reserved10";
})(IPOperationMode || (IPOperationMode = {}));
function validateOperationMode(operationMode) {
    switch (operationMode) {
        case IPOperationMode.Normal:
        case IPOperationMode.BlockedFullReporting:
        case IPOperationMode.PhishingProtection:
        case IPOperationMode.BlockedOnly:
            return operationMode;
        case IPOperationMode.Learning:
            return IPOperationMode.BlockedFullReporting;
        default:
            logError(`Unknown or reserved identity protection operation mode: ${operationMode}`);
            return undefined;
    }
}
function shouldDisableInput(category, operationMode, linkProtectionWouldBlock) {
    if (isGoodCategory(category)) {
        return false;
    }
    if (maybe_none(category)) {
        category = IPPageCategory.Unknown;
    }
    switch (operationMode) {
        case IPOperationMode.Normal:
            return true;
        case IPOperationMode.PhishingProtection:
            return category === IPPageCategory.Blocked || linkProtectionWouldBlock;
        case IPOperationMode.BlockedFullReporting:
        case IPOperationMode.BlockedOnly:
            return category === IPPageCategory.Blocked;
    }
}
function shouldMakePhishingReport(category, operationMode, linkProtectionWouldBlock) {
    if (maybe_none(category) || isGoodCategory(category)) {
        return false;
    }
    switch (operationMode) {
        case IPOperationMode.Normal:
        case IPOperationMode.BlockedFullReporting:
            return true;
        case IPOperationMode.PhishingProtection:
            return category === IPPageCategory.Blocked || linkProtectionWouldBlock;
        case IPOperationMode.BlockedOnly:
            return category === IPPageCategory.Blocked;
    }
}
function isInputAllowableOpMode(operationMode) {
    return operationMode === IPOperationMode.Normal || operationMode === IPOperationMode.PhishingProtection;
}
var IPReportType;
(function (IPReportType) {
    IPReportType[IPReportType["CrendentialExtension"] = 0] = "CrendentialExtension";
    IPReportType[IPReportType["SmartScreen"] = 1] = "SmartScreen";
    IPReportType[IPReportType["URLFilteringExtension"] = 2] = "URLFilteringExtension";
    IPReportType[IPReportType["DomainAgeExtension"] = 3] = "DomainAgeExtension";
    IPReportType[IPReportType["DomainAgeURLFilteringExtension"] = 4] = "DomainAgeURLFilteringExtension";
    IPReportType[IPReportType["StatusCodeURLFilteringExtension"] = 5] = "StatusCodeURLFilteringExtension";
    IPReportType[IPReportType["AIBrandLogoProtectionExtension"] = 6] = "AIBrandLogoProtectionExtension";
})(IPReportType || (IPReportType = {}));
var IPReportActions;
(function (IPReportActions) {
    IPReportActions[IPReportActions["Unknown"] = 0] = "Unknown";
    IPReportActions[IPReportActions["InputAllowed"] = 1] = "InputAllowed";
    IPReportActions[IPReportActions["FormSubmitted"] = 2] = "FormSubmitted";
    IPReportActions[IPReportActions["LearningModeBypass"] = 3] = "LearningModeBypass";
    IPReportActions[IPReportActions["BlockedByBlocklist"] = 4] = "BlockedByBlocklist";
})(IPReportActions || (IPReportActions = {}));

;// CONCATENATED MODULE: ./config-keys.ts
var ConfigKey;
(function (ConfigKey) {
    ConfigKey[ConfigKey["config"] = 0] = "config";
    ConfigKey[ConfigKey["reputableSites"] = 1] = "reputableSites";
    ConfigKey[ConfigKey["sbxEnabledFeatures"] = 2] = "sbxEnabledFeatures";
})(ConfigKey || (ConfigKey = {}));

;// CONCATENATED MODULE: ../node_modules/lru-cache/dist/esm/index.js
/**
 * @module LRUCache
 */
const perf = typeof performance === 'object' &&
    performance &&
    typeof performance.now === 'function'
    ? performance
    : Date;
const warned = new Set();
/* c8 ignore start */
const PROCESS = (typeof process === 'object' && !!process ? process : {});
/* c8 ignore start */
const emitWarning = (msg, type, code, fn) => {
    typeof PROCESS.emitWarning === 'function'
        ? PROCESS.emitWarning(msg, type, code, fn)
        : console.error(`[${code}] ${type}: ${msg}`);
};
let AC = globalThis.AbortController;
let AS = globalThis.AbortSignal;
/* c8 ignore start */
if (typeof AC === 'undefined') {
    //@ts-ignore
    AS = class AbortSignal {
        onabort;
        _onabort = [];
        reason;
        aborted = false;
        addEventListener(_, fn) {
            this._onabort.push(fn);
        }
    };
    //@ts-ignore
    AC = class AbortController {
        constructor() {
            warnACPolyfill();
        }
        signal = new AS();
        abort(reason) {
            if (this.signal.aborted)
                return;
            //@ts-ignore
            this.signal.reason = reason;
            //@ts-ignore
            this.signal.aborted = true;
            //@ts-ignore
            for (const fn of this.signal._onabort) {
                fn(reason);
            }
            this.signal.onabort?.(reason);
        }
    };
    let printACPolyfillWarning = PROCESS.env?.LRU_CACHE_IGNORE_AC_WARNING !== '1';
    const warnACPolyfill = () => {
        if (!printACPolyfillWarning)
            return;
        printACPolyfillWarning = false;
        emitWarning('AbortController is not defined. If using lru-cache in ' +
            'node 14, load an AbortController polyfill from the ' +
            '`node-abort-controller` package. A minimal polyfill is ' +
            'provided for use by LRUCache.fetch(), but it should not be ' +
            'relied upon in other contexts (eg, passing it to other APIs that ' +
            'use AbortController/AbortSignal might have undesirable effects). ' +
            'You may disable this with LRU_CACHE_IGNORE_AC_WARNING=1 in the env.', 'NO_ABORT_CONTROLLER', 'ENOTSUP', warnACPolyfill);
    };
}
/* c8 ignore stop */
const shouldWarn = (code) => !warned.has(code);
const TYPE = Symbol('type');
const isPosInt = (n) => n && n === Math.floor(n) && n > 0 && isFinite(n);
/* c8 ignore start */
// This is a little bit ridiculous, tbh.
// The maximum array length is 2^32-1 or thereabouts on most JS impls.
// And well before that point, you're caching the entire world, I mean,
// that's ~32GB of just integers for the next/prev links, plus whatever
// else to hold that many keys and values.  Just filling the memory with
// zeroes at init time is brutal when you get that big.
// But why not be complete?
// Maybe in the future, these limits will have expanded.
const getUintArray = (max) => !isPosInt(max)
    ? null
    : max <= Math.pow(2, 8)
        ? Uint8Array
        : max <= Math.pow(2, 16)
            ? Uint16Array
            : max <= Math.pow(2, 32)
                ? Uint32Array
                : max <= Number.MAX_SAFE_INTEGER
                    ? ZeroArray
                    : null;
/* c8 ignore stop */
class ZeroArray extends Array {
    constructor(size) {
        super(size);
        this.fill(0);
    }
}
class Stack {
    heap;
    length;
    // private constructor
    static #constructing = false;
    static create(max) {
        const HeapCls = getUintArray(max);
        if (!HeapCls)
            return [];
        Stack.#constructing = true;
        const s = new Stack(max, HeapCls);
        Stack.#constructing = false;
        return s;
    }
    constructor(max, HeapCls) {
        /* c8 ignore start */
        if (!Stack.#constructing) {
            throw new TypeError('instantiate Stack using Stack.create(n)');
        }
        /* c8 ignore stop */
        this.heap = new HeapCls(max);
        this.length = 0;
    }
    push(n) {
        this.heap[this.length++] = n;
    }
    pop() {
        return this.heap[--this.length];
    }
}
/**
 * Default export, the thing you're using this module to get.
 *
 * All properties from the options object (with the exception of
 * {@link OptionsBase.max} and {@link OptionsBase.maxSize}) are added as
 * normal public members. (`max` and `maxBase` are read-only getters.)
 * Changing any of these will alter the defaults for subsequent method calls,
 * but is otherwise safe.
 */
class LRUCache {
    // properties coming in from the options of these, only max and maxSize
    // really *need* to be protected. The rest can be modified, as they just
    // set defaults for various methods.
    #max;
    #maxSize;
    #dispose;
    #disposeAfter;
    #fetchMethod;
    /**
     * {@link LRUCache.OptionsBase.ttl}
     */
    ttl;
    /**
     * {@link LRUCache.OptionsBase.ttlResolution}
     */
    ttlResolution;
    /**
     * {@link LRUCache.OptionsBase.ttlAutopurge}
     */
    ttlAutopurge;
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnGet}
     */
    updateAgeOnGet;
    /**
     * {@link LRUCache.OptionsBase.updateAgeOnHas}
     */
    updateAgeOnHas;
    /**
     * {@link LRUCache.OptionsBase.allowStale}
     */
    allowStale;
    /**
     * {@link LRUCache.OptionsBase.noDisposeOnSet}
     */
    noDisposeOnSet;
    /**
     * {@link LRUCache.OptionsBase.noUpdateTTL}
     */
    noUpdateTTL;
    /**
     * {@link LRUCache.OptionsBase.maxEntrySize}
     */
    maxEntrySize;
    /**
     * {@link LRUCache.OptionsBase.sizeCalculation}
     */
    sizeCalculation;
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnFetchRejection}
     */
    noDeleteOnFetchRejection;
    /**
     * {@link LRUCache.OptionsBase.noDeleteOnStaleGet}
     */
    noDeleteOnStaleGet;
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchAbort}
     */
    allowStaleOnFetchAbort;
    /**
     * {@link LRUCache.OptionsBase.allowStaleOnFetchRejection}
     */
    allowStaleOnFetchRejection;
    /**
     * {@link LRUCache.OptionsBase.ignoreFetchAbort}
     */
    ignoreFetchAbort;
    // computed properties
    #size;
    #calculatedSize;
    #keyMap;
    #keyList;
    #valList;
    #next;
    #prev;
    #head;
    #tail;
    #free;
    #disposed;
    #sizes;
    #starts;
    #ttls;
    #hasDispose;
    #hasFetchMethod;
    #hasDisposeAfter;
    /**
     * Do not call this method unless you need to inspect the
     * inner workings of the cache.  If anything returned by this
     * object is modified in any way, strange breakage may occur.
     *
     * These fields are private for a reason!
     *
     * @internal
     */
    static unsafeExposeInternals(c) {
        return {
            // properties
            starts: c.#starts,
            ttls: c.#ttls,
            sizes: c.#sizes,
            keyMap: c.#keyMap,
            keyList: c.#keyList,
            valList: c.#valList,
            next: c.#next,
            prev: c.#prev,
            get head() {
                return c.#head;
            },
            get tail() {
                return c.#tail;
            },
            free: c.#free,
            // methods
            isBackgroundFetch: (p) => c.#isBackgroundFetch(p),
            backgroundFetch: (k, index, options, context) => c.#backgroundFetch(k, index, options, context),
            moveToTail: (index) => c.#moveToTail(index),
            indexes: (options) => c.#indexes(options),
            rindexes: (options) => c.#rindexes(options),
            isStale: (index) => c.#isStale(index),
        };
    }
    // Protected read-only members
    /**
     * {@link LRUCache.OptionsBase.max} (read-only)
     */
    get max() {
        return this.#max;
    }
    /**
     * {@link LRUCache.OptionsBase.maxSize} (read-only)
     */
    get maxSize() {
        return this.#maxSize;
    }
    /**
     * The total computed size of items in the cache (read-only)
     */
    get calculatedSize() {
        return this.#calculatedSize;
    }
    /**
     * The number of items stored in the cache (read-only)
     */
    get size() {
        return this.#size;
    }
    /**
     * {@link LRUCache.OptionsBase.fetchMethod} (read-only)
     */
    get fetchMethod() {
        return this.#fetchMethod;
    }
    /**
     * {@link LRUCache.OptionsBase.dispose} (read-only)
     */
    get dispose() {
        return this.#dispose;
    }
    /**
     * {@link LRUCache.OptionsBase.disposeAfter} (read-only)
     */
    get disposeAfter() {
        return this.#disposeAfter;
    }
    constructor(options) {
        const { max = 0, ttl, ttlResolution = 1, ttlAutopurge, updateAgeOnGet, updateAgeOnHas, allowStale, dispose, disposeAfter, noDisposeOnSet, noUpdateTTL, maxSize = 0, maxEntrySize = 0, sizeCalculation, fetchMethod, noDeleteOnFetchRejection, noDeleteOnStaleGet, allowStaleOnFetchRejection, allowStaleOnFetchAbort, ignoreFetchAbort, } = options;
        if (max !== 0 && !isPosInt(max)) {
            throw new TypeError('max option must be a nonnegative integer');
        }
        const UintArray = max ? getUintArray(max) : Array;
        if (!UintArray) {
            throw new Error('invalid max value: ' + max);
        }
        this.#max = max;
        this.#maxSize = maxSize;
        this.maxEntrySize = maxEntrySize || this.#maxSize;
        this.sizeCalculation = sizeCalculation;
        if (this.sizeCalculation) {
            if (!this.#maxSize && !this.maxEntrySize) {
                throw new TypeError('cannot set sizeCalculation without setting maxSize or maxEntrySize');
            }
            if (typeof this.sizeCalculation !== 'function') {
                throw new TypeError('sizeCalculation set to non-function');
            }
        }
        if (fetchMethod !== undefined &&
            typeof fetchMethod !== 'function') {
            throw new TypeError('fetchMethod must be a function if specified');
        }
        this.#fetchMethod = fetchMethod;
        this.#hasFetchMethod = !!fetchMethod;
        this.#keyMap = new Map();
        this.#keyList = new Array(max).fill(undefined);
        this.#valList = new Array(max).fill(undefined);
        this.#next = new UintArray(max);
        this.#prev = new UintArray(max);
        this.#head = 0;
        this.#tail = 0;
        this.#free = Stack.create(max);
        this.#size = 0;
        this.#calculatedSize = 0;
        if (typeof dispose === 'function') {
            this.#dispose = dispose;
        }
        if (typeof disposeAfter === 'function') {
            this.#disposeAfter = disposeAfter;
            this.#disposed = [];
        }
        else {
            this.#disposeAfter = undefined;
            this.#disposed = undefined;
        }
        this.#hasDispose = !!this.#dispose;
        this.#hasDisposeAfter = !!this.#disposeAfter;
        this.noDisposeOnSet = !!noDisposeOnSet;
        this.noUpdateTTL = !!noUpdateTTL;
        this.noDeleteOnFetchRejection = !!noDeleteOnFetchRejection;
        this.allowStaleOnFetchRejection = !!allowStaleOnFetchRejection;
        this.allowStaleOnFetchAbort = !!allowStaleOnFetchAbort;
        this.ignoreFetchAbort = !!ignoreFetchAbort;
        // NB: maxEntrySize is set to maxSize if it's set
        if (this.maxEntrySize !== 0) {
            if (this.#maxSize !== 0) {
                if (!isPosInt(this.#maxSize)) {
                    throw new TypeError('maxSize must be a positive integer if specified');
                }
            }
            if (!isPosInt(this.maxEntrySize)) {
                throw new TypeError('maxEntrySize must be a positive integer if specified');
            }
            this.#initializeSizeTracking();
        }
        this.allowStale = !!allowStale;
        this.noDeleteOnStaleGet = !!noDeleteOnStaleGet;
        this.updateAgeOnGet = !!updateAgeOnGet;
        this.updateAgeOnHas = !!updateAgeOnHas;
        this.ttlResolution =
            isPosInt(ttlResolution) || ttlResolution === 0
                ? ttlResolution
                : 1;
        this.ttlAutopurge = !!ttlAutopurge;
        this.ttl = ttl || 0;
        if (this.ttl) {
            if (!isPosInt(this.ttl)) {
                throw new TypeError('ttl must be a positive integer if specified');
            }
            this.#initializeTTLTracking();
        }
        // do not allow completely unbounded caches
        if (this.#max === 0 && this.ttl === 0 && this.#maxSize === 0) {
            throw new TypeError('At least one of max, maxSize, or ttl is required');
        }
        if (!this.ttlAutopurge && !this.#max && !this.#maxSize) {
            const code = 'LRU_CACHE_UNBOUNDED';
            if (shouldWarn(code)) {
                warned.add(code);
                const msg = 'TTL caching without ttlAutopurge, max, or maxSize can ' +
                    'result in unbounded memory consumption.';
                emitWarning(msg, 'UnboundedCacheWarning', code, LRUCache);
            }
        }
    }
    /**
     * Return the remaining TTL time for a given entry key
     */
    getRemainingTTL(key) {
        return this.#keyMap.has(key) ? Infinity : 0;
    }
    #initializeTTLTracking() {
        const ttls = new ZeroArray(this.#max);
        const starts = new ZeroArray(this.#max);
        this.#ttls = ttls;
        this.#starts = starts;
        this.#setItemTTL = (index, ttl, start = perf.now()) => {
            starts[index] = ttl !== 0 ? start : 0;
            ttls[index] = ttl;
            if (ttl !== 0 && this.ttlAutopurge) {
                const t = setTimeout(() => {
                    if (this.#isStale(index)) {
                        this.delete(this.#keyList[index]);
                    }
                }, ttl + 1);
                // unref() not supported on all platforms
                /* c8 ignore start */
                if (t.unref) {
                    t.unref();
                }
                /* c8 ignore stop */
            }
        };
        this.#updateItemAge = index => {
            starts[index] = ttls[index] !== 0 ? perf.now() : 0;
        };
        this.#statusTTL = (status, index) => {
            if (ttls[index]) {
                const ttl = ttls[index];
                const start = starts[index];
                /* c8 ignore next */
                if (!ttl || !start)
                    return;
                status.ttl = ttl;
                status.start = start;
                status.now = cachedNow || getNow();
                const age = status.now - start;
                status.remainingTTL = ttl - age;
            }
        };
        // debounce calls to perf.now() to 1s so we're not hitting
        // that costly call repeatedly.
        let cachedNow = 0;
        const getNow = () => {
            const n = perf.now();
            if (this.ttlResolution > 0) {
                cachedNow = n;
                const t = setTimeout(() => (cachedNow = 0), this.ttlResolution);
                // not available on all platforms
                /* c8 ignore start */
                if (t.unref) {
                    t.unref();
                }
                /* c8 ignore stop */
            }
            return n;
        };
        this.getRemainingTTL = key => {
            const index = this.#keyMap.get(key);
            if (index === undefined) {
                return 0;
            }
            const ttl = ttls[index];
            const start = starts[index];
            if (!ttl || !start) {
                return Infinity;
            }
            const age = (cachedNow || getNow()) - start;
            return ttl - age;
        };
        this.#isStale = index => {
            const s = starts[index];
            const t = ttls[index];
            return !!t && !!s && (cachedNow || getNow()) - s > t;
        };
    }
    // conditionally set private methods related to TTL
    #updateItemAge = () => { };
    #statusTTL = () => { };
    #setItemTTL = () => { };
    /* c8 ignore stop */
    #isStale = () => false;
    #initializeSizeTracking() {
        const sizes = new ZeroArray(this.#max);
        this.#calculatedSize = 0;
        this.#sizes = sizes;
        this.#removeItemSize = index => {
            this.#calculatedSize -= sizes[index];
            sizes[index] = 0;
        };
        this.#requireSize = (k, v, size, sizeCalculation) => {
            // provisionally accept background fetches.
            // actual value size will be checked when they return.
            if (this.#isBackgroundFetch(v)) {
                return 0;
            }
            if (!isPosInt(size)) {
                if (sizeCalculation) {
                    if (typeof sizeCalculation !== 'function') {
                        throw new TypeError('sizeCalculation must be a function');
                    }
                    size = sizeCalculation(v, k);
                    if (!isPosInt(size)) {
                        throw new TypeError('sizeCalculation return invalid (expect positive integer)');
                    }
                }
                else {
                    throw new TypeError('invalid size value (must be positive integer). ' +
                        'When maxSize or maxEntrySize is used, sizeCalculation ' +
                        'or size must be set.');
                }
            }
            return size;
        };
        this.#addItemSize = (index, size, status) => {
            sizes[index] = size;
            if (this.#maxSize) {
                const maxSize = this.#maxSize - sizes[index];
                while (this.#calculatedSize > maxSize) {
                    this.#evict(true);
                }
            }
            this.#calculatedSize += sizes[index];
            if (status) {
                status.entrySize = size;
                status.totalCalculatedSize = this.#calculatedSize;
            }
        };
    }
    #removeItemSize = _i => { };
    #addItemSize = (_i, _s, _st) => { };
    #requireSize = (_k, _v, size, sizeCalculation) => {
        if (size || sizeCalculation) {
            throw new TypeError('cannot set size without setting maxSize or maxEntrySize on cache');
        }
        return 0;
    };
    *#indexes({ allowStale = this.allowStale } = {}) {
        if (this.#size) {
            for (let i = this.#tail; true;) {
                if (!this.#isValidIndex(i)) {
                    break;
                }
                if (allowStale || !this.#isStale(i)) {
                    yield i;
                }
                if (i === this.#head) {
                    break;
                }
                else {
                    i = this.#prev[i];
                }
            }
        }
    }
    *#rindexes({ allowStale = this.allowStale } = {}) {
        if (this.#size) {
            for (let i = this.#head; true;) {
                if (!this.#isValidIndex(i)) {
                    break;
                }
                if (allowStale || !this.#isStale(i)) {
                    yield i;
                }
                if (i === this.#tail) {
                    break;
                }
                else {
                    i = this.#next[i];
                }
            }
        }
    }
    #isValidIndex(index) {
        return (index !== undefined &&
            this.#keyMap.get(this.#keyList[index]) === index);
    }
    /**
     * Return a generator yielding `[key, value]` pairs,
     * in order from most recently used to least recently used.
     */
    *entries() {
        for (const i of this.#indexes()) {
            if (this.#valList[i] !== undefined &&
                this.#keyList[i] !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield [this.#keyList[i], this.#valList[i]];
            }
        }
    }
    /**
     * Inverse order version of {@link LRUCache.entries}
     *
     * Return a generator yielding `[key, value]` pairs,
     * in order from least recently used to most recently used.
     */
    *rentries() {
        for (const i of this.#rindexes()) {
            if (this.#valList[i] !== undefined &&
                this.#keyList[i] !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield [this.#keyList[i], this.#valList[i]];
            }
        }
    }
    /**
     * Return a generator yielding the keys in the cache,
     * in order from most recently used to least recently used.
     */
    *keys() {
        for (const i of this.#indexes()) {
            const k = this.#keyList[i];
            if (k !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield k;
            }
        }
    }
    /**
     * Inverse order version of {@link LRUCache.keys}
     *
     * Return a generator yielding the keys in the cache,
     * in order from least recently used to most recently used.
     */
    *rkeys() {
        for (const i of this.#rindexes()) {
            const k = this.#keyList[i];
            if (k !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield k;
            }
        }
    }
    /**
     * Return a generator yielding the values in the cache,
     * in order from most recently used to least recently used.
     */
    *values() {
        for (const i of this.#indexes()) {
            const v = this.#valList[i];
            if (v !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield this.#valList[i];
            }
        }
    }
    /**
     * Inverse order version of {@link LRUCache.values}
     *
     * Return a generator yielding the values in the cache,
     * in order from least recently used to most recently used.
     */
    *rvalues() {
        for (const i of this.#rindexes()) {
            const v = this.#valList[i];
            if (v !== undefined &&
                !this.#isBackgroundFetch(this.#valList[i])) {
                yield this.#valList[i];
            }
        }
    }
    /**
     * Iterating over the cache itself yields the same results as
     * {@link LRUCache.entries}
     */
    [Symbol.iterator]() {
        return this.entries();
    }
    /**
     * Find a value for which the supplied fn method returns a truthy value,
     * similar to Array.find().  fn is called as fn(value, key, cache).
     */
    find(fn, getOptions = {}) {
        for (const i of this.#indexes()) {
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined)
                continue;
            if (fn(value, this.#keyList[i], this)) {
                return this.get(this.#keyList[i], getOptions);
            }
        }
    }
    /**
     * Call the supplied function on each item in the cache, in order from
     * most recently used to least recently used.  fn is called as
     * fn(value, key, cache).  Does not update age or recenty of use.
     * Does not iterate over stale values.
     */
    forEach(fn, thisp = this) {
        for (const i of this.#indexes()) {
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined)
                continue;
            fn.call(thisp, value, this.#keyList[i], this);
        }
    }
    /**
     * The same as {@link LRUCache.forEach} but items are iterated over in
     * reverse order.  (ie, less recently used items are iterated over first.)
     */
    rforEach(fn, thisp = this) {
        for (const i of this.#rindexes()) {
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined)
                continue;
            fn.call(thisp, value, this.#keyList[i], this);
        }
    }
    /**
     * Delete any stale entries. Returns true if anything was removed,
     * false otherwise.
     */
    purgeStale() {
        let deleted = false;
        for (const i of this.#rindexes({ allowStale: true })) {
            if (this.#isStale(i)) {
                this.delete(this.#keyList[i]);
                deleted = true;
            }
        }
        return deleted;
    }
    /**
     * Get the extended info about a given entry, to get its value, size, and
     * TTL info simultaneously. Like {@link LRUCache#dump}, but just for a
     * single key. Always returns stale values, if their info is found in the
     * cache, so be sure to check for expired TTLs if relevant.
     */
    info(key) {
        const i = this.#keyMap.get(key);
        if (i === undefined)
            return undefined;
        const v = this.#valList[i];
        const value = this.#isBackgroundFetch(v)
            ? v.__staleWhileFetching
            : v;
        if (value === undefined)
            return undefined;
        const entry = { value };
        if (this.#ttls && this.#starts) {
            const ttl = this.#ttls[i];
            const start = this.#starts[i];
            if (ttl && start) {
                const remain = ttl - (perf.now() - start);
                entry.ttl = remain;
                entry.start = Date.now();
            }
        }
        if (this.#sizes) {
            entry.size = this.#sizes[i];
        }
        return entry;
    }
    /**
     * Return an array of [key, {@link LRUCache.Entry}] tuples which can be
     * passed to cache.load()
     */
    dump() {
        const arr = [];
        for (const i of this.#indexes({ allowStale: true })) {
            const key = this.#keyList[i];
            const v = this.#valList[i];
            const value = this.#isBackgroundFetch(v)
                ? v.__staleWhileFetching
                : v;
            if (value === undefined || key === undefined)
                continue;
            const entry = { value };
            if (this.#ttls && this.#starts) {
                entry.ttl = this.#ttls[i];
                // always dump the start relative to a portable timestamp
                // it's ok for this to be a bit slow, it's a rare operation.
                const age = perf.now() - this.#starts[i];
                entry.start = Math.floor(Date.now() - age);
            }
            if (this.#sizes) {
                entry.size = this.#sizes[i];
            }
            arr.unshift([key, entry]);
        }
        return arr;
    }
    /**
     * Reset the cache and load in the items in entries in the order listed.
     * Note that the shape of the resulting cache may be different if the
     * same options are not used in both caches.
     */
    load(arr) {
        this.clear();
        for (const [key, entry] of arr) {
            if (entry.start) {
                // entry.start is a portable timestamp, but we may be using
                // node's performance.now(), so calculate the offset, so that
                // we get the intended remaining TTL, no matter how long it's
                // been on ice.
                //
                // it's ok for this to be a bit slow, it's a rare operation.
                const age = Date.now() - entry.start;
                entry.start = perf.now() - age;
            }
            this.set(key, entry.value, entry);
        }
    }
    /**
     * Add a value to the cache.
     *
     * Note: if `undefined` is specified as a value, this is an alias for
     * {@link LRUCache#delete}
     */
    set(k, v, setOptions = {}) {
        if (v === undefined) {
            this.delete(k);
            return this;
        }
        const { ttl = this.ttl, start, noDisposeOnSet = this.noDisposeOnSet, sizeCalculation = this.sizeCalculation, status, } = setOptions;
        let { noUpdateTTL = this.noUpdateTTL } = setOptions;
        const size = this.#requireSize(k, v, setOptions.size || 0, sizeCalculation);
        // if the item doesn't fit, don't do anything
        // NB: maxEntrySize set to maxSize by default
        if (this.maxEntrySize && size > this.maxEntrySize) {
            if (status) {
                status.set = 'miss';
                status.maxEntrySizeExceeded = true;
            }
            // have to delete, in case something is there already.
            this.delete(k);
            return this;
        }
        let index = this.#size === 0 ? undefined : this.#keyMap.get(k);
        if (index === undefined) {
            // addition
            index = (this.#size === 0
                ? this.#tail
                : this.#free.length !== 0
                    ? this.#free.pop()
                    : this.#size === this.#max
                        ? this.#evict(false)
                        : this.#size);
            this.#keyList[index] = k;
            this.#valList[index] = v;
            this.#keyMap.set(k, index);
            this.#next[this.#tail] = index;
            this.#prev[index] = this.#tail;
            this.#tail = index;
            this.#size++;
            this.#addItemSize(index, size, status);
            if (status)
                status.set = 'add';
            noUpdateTTL = false;
        }
        else {
            // update
            this.#moveToTail(index);
            const oldVal = this.#valList[index];
            if (v !== oldVal) {
                if (this.#hasFetchMethod && this.#isBackgroundFetch(oldVal)) {
                    oldVal.__abortController.abort(new Error('replaced'));
                    const { __staleWhileFetching: s } = oldVal;
                    if (s !== undefined && !noDisposeOnSet) {
                        if (this.#hasDispose) {
                            this.#dispose?.(s, k, 'set');
                        }
                        if (this.#hasDisposeAfter) {
                            this.#disposed?.push([s, k, 'set']);
                        }
                    }
                }
                else if (!noDisposeOnSet) {
                    if (this.#hasDispose) {
                        this.#dispose?.(oldVal, k, 'set');
                    }
                    if (this.#hasDisposeAfter) {
                        this.#disposed?.push([oldVal, k, 'set']);
                    }
                }
                this.#removeItemSize(index);
                this.#addItemSize(index, size, status);
                this.#valList[index] = v;
                if (status) {
                    status.set = 'replace';
                    const oldValue = oldVal && this.#isBackgroundFetch(oldVal)
                        ? oldVal.__staleWhileFetching
                        : oldVal;
                    if (oldValue !== undefined)
                        status.oldValue = oldValue;
                }
            }
            else if (status) {
                status.set = 'update';
            }
        }
        if (ttl !== 0 && !this.#ttls) {
            this.#initializeTTLTracking();
        }
        if (this.#ttls) {
            if (!noUpdateTTL) {
                this.#setItemTTL(index, ttl, start);
            }
            if (status)
                this.#statusTTL(status, index);
        }
        if (!noDisposeOnSet && this.#hasDisposeAfter && this.#disposed) {
            const dt = this.#disposed;
            let task;
            while ((task = dt?.shift())) {
                this.#disposeAfter?.(...task);
            }
        }
        return this;
    }
    /**
     * Evict the least recently used item, returning its value or
     * `undefined` if cache is empty.
     */
    pop() {
        try {
            while (this.#size) {
                const val = this.#valList[this.#head];
                this.#evict(true);
                if (this.#isBackgroundFetch(val)) {
                    if (val.__staleWhileFetching) {
                        return val.__staleWhileFetching;
                    }
                }
                else if (val !== undefined) {
                    return val;
                }
            }
        }
        finally {
            if (this.#hasDisposeAfter && this.#disposed) {
                const dt = this.#disposed;
                let task;
                while ((task = dt?.shift())) {
                    this.#disposeAfter?.(...task);
                }
            }
        }
    }
    #evict(free) {
        const head = this.#head;
        const k = this.#keyList[head];
        const v = this.#valList[head];
        if (this.#hasFetchMethod && this.#isBackgroundFetch(v)) {
            v.__abortController.abort(new Error('evicted'));
        }
        else if (this.#hasDispose || this.#hasDisposeAfter) {
            if (this.#hasDispose) {
                this.#dispose?.(v, k, 'evict');
            }
            if (this.#hasDisposeAfter) {
                this.#disposed?.push([v, k, 'evict']);
            }
        }
        this.#removeItemSize(head);
        // if we aren't about to use the index, then null these out
        if (free) {
            this.#keyList[head] = undefined;
            this.#valList[head] = undefined;
            this.#free.push(head);
        }
        if (this.#size === 1) {
            this.#head = this.#tail = 0;
            this.#free.length = 0;
        }
        else {
            this.#head = this.#next[head];
        }
        this.#keyMap.delete(k);
        this.#size--;
        return head;
    }
    /**
     * Check if a key is in the cache, without updating the recency of use.
     * Will return false if the item is stale, even though it is technically
     * in the cache.
     *
     * Will not update item age unless
     * {@link LRUCache.OptionsBase.updateAgeOnHas} is set.
     */
    has(k, hasOptions = {}) {
        const { updateAgeOnHas = this.updateAgeOnHas, status } = hasOptions;
        const index = this.#keyMap.get(k);
        if (index !== undefined) {
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v) &&
                v.__staleWhileFetching === undefined) {
                return false;
            }
            if (!this.#isStale(index)) {
                if (updateAgeOnHas) {
                    this.#updateItemAge(index);
                }
                if (status) {
                    status.has = 'hit';
                    this.#statusTTL(status, index);
                }
                return true;
            }
            else if (status) {
                status.has = 'stale';
                this.#statusTTL(status, index);
            }
        }
        else if (status) {
            status.has = 'miss';
        }
        return false;
    }
    /**
     * Like {@link LRUCache#get} but doesn't update recency or delete stale
     * items.
     *
     * Returns `undefined` if the item is stale, unless
     * {@link LRUCache.OptionsBase.allowStale} is set.
     */
    peek(k, peekOptions = {}) {
        const { allowStale = this.allowStale } = peekOptions;
        const index = this.#keyMap.get(k);
        if (index === undefined ||
            (!allowStale && this.#isStale(index))) {
            return;
        }
        const v = this.#valList[index];
        // either stale and allowed, or forcing a refresh of non-stale value
        return this.#isBackgroundFetch(v) ? v.__staleWhileFetching : v;
    }
    #backgroundFetch(k, index, options, context) {
        const v = index === undefined ? undefined : this.#valList[index];
        if (this.#isBackgroundFetch(v)) {
            return v;
        }
        const ac = new AC();
        const { signal } = options;
        // when/if our AC signals, then stop listening to theirs.
        signal?.addEventListener('abort', () => ac.abort(signal.reason), {
            signal: ac.signal,
        });
        const fetchOpts = {
            signal: ac.signal,
            options,
            context,
        };
        const cb = (v, updateCache = false) => {
            const { aborted } = ac.signal;
            const ignoreAbort = options.ignoreFetchAbort && v !== undefined;
            if (options.status) {
                if (aborted && !updateCache) {
                    options.status.fetchAborted = true;
                    options.status.fetchError = ac.signal.reason;
                    if (ignoreAbort)
                        options.status.fetchAbortIgnored = true;
                }
                else {
                    options.status.fetchResolved = true;
                }
            }
            if (aborted && !ignoreAbort && !updateCache) {
                return fetchFail(ac.signal.reason);
            }
            // either we didn't abort, and are still here, or we did, and ignored
            const bf = p;
            if (this.#valList[index] === p) {
                if (v === undefined) {
                    if (bf.__staleWhileFetching) {
                        this.#valList[index] = bf.__staleWhileFetching;
                    }
                    else {
                        this.delete(k);
                    }
                }
                else {
                    if (options.status)
                        options.status.fetchUpdated = true;
                    this.set(k, v, fetchOpts.options);
                }
            }
            return v;
        };
        const eb = (er) => {
            if (options.status) {
                options.status.fetchRejected = true;
                options.status.fetchError = er;
            }
            return fetchFail(er);
        };
        const fetchFail = (er) => {
            const { aborted } = ac.signal;
            const allowStaleAborted = aborted && options.allowStaleOnFetchAbort;
            const allowStale = allowStaleAborted || options.allowStaleOnFetchRejection;
            const noDelete = allowStale || options.noDeleteOnFetchRejection;
            const bf = p;
            if (this.#valList[index] === p) {
                // if we allow stale on fetch rejections, then we need to ensure that
                // the stale value is not removed from the cache when the fetch fails.
                const del = !noDelete || bf.__staleWhileFetching === undefined;
                if (del) {
                    this.delete(k);
                }
                else if (!allowStaleAborted) {
                    // still replace the *promise* with the stale value,
                    // since we are done with the promise at this point.
                    // leave it untouched if we're still waiting for an
                    // aborted background fetch that hasn't yet returned.
                    this.#valList[index] = bf.__staleWhileFetching;
                }
            }
            if (allowStale) {
                if (options.status && bf.__staleWhileFetching !== undefined) {
                    options.status.returnedStale = true;
                }
                return bf.__staleWhileFetching;
            }
            else if (bf.__returned === bf) {
                throw er;
            }
        };
        const pcall = (res, rej) => {
            const fmp = this.#fetchMethod?.(k, v, fetchOpts);
            if (fmp && fmp instanceof Promise) {
                fmp.then(v => res(v === undefined ? undefined : v), rej);
            }
            // ignored, we go until we finish, regardless.
            // defer check until we are actually aborting,
            // so fetchMethod can override.
            ac.signal.addEventListener('abort', () => {
                if (!options.ignoreFetchAbort ||
                    options.allowStaleOnFetchAbort) {
                    res(undefined);
                    // when it eventually resolves, update the cache.
                    if (options.allowStaleOnFetchAbort) {
                        res = v => cb(v, true);
                    }
                }
            });
        };
        if (options.status)
            options.status.fetchDispatched = true;
        const p = new Promise(pcall).then(cb, eb);
        const bf = Object.assign(p, {
            __abortController: ac,
            __staleWhileFetching: v,
            __returned: undefined,
        });
        if (index === undefined) {
            // internal, don't expose status.
            this.set(k, bf, { ...fetchOpts.options, status: undefined });
            index = this.#keyMap.get(k);
        }
        else {
            this.#valList[index] = bf;
        }
        return bf;
    }
    #isBackgroundFetch(p) {
        if (!this.#hasFetchMethod)
            return false;
        const b = p;
        return (!!b &&
            b instanceof Promise &&
            b.hasOwnProperty('__staleWhileFetching') &&
            b.__abortController instanceof AC);
    }
    async fetch(k, fetchOptions = {}) {
        const { 
        // get options
        allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, 
        // set options
        ttl = this.ttl, noDisposeOnSet = this.noDisposeOnSet, size = 0, sizeCalculation = this.sizeCalculation, noUpdateTTL = this.noUpdateTTL, 
        // fetch exclusive options
        noDeleteOnFetchRejection = this.noDeleteOnFetchRejection, allowStaleOnFetchRejection = this.allowStaleOnFetchRejection, ignoreFetchAbort = this.ignoreFetchAbort, allowStaleOnFetchAbort = this.allowStaleOnFetchAbort, context, forceRefresh = false, status, signal, } = fetchOptions;
        if (!this.#hasFetchMethod) {
            if (status)
                status.fetch = 'get';
            return this.get(k, {
                allowStale,
                updateAgeOnGet,
                noDeleteOnStaleGet,
                status,
            });
        }
        const options = {
            allowStale,
            updateAgeOnGet,
            noDeleteOnStaleGet,
            ttl,
            noDisposeOnSet,
            size,
            sizeCalculation,
            noUpdateTTL,
            noDeleteOnFetchRejection,
            allowStaleOnFetchRejection,
            allowStaleOnFetchAbort,
            ignoreFetchAbort,
            status,
            signal,
        };
        let index = this.#keyMap.get(k);
        if (index === undefined) {
            if (status)
                status.fetch = 'miss';
            const p = this.#backgroundFetch(k, index, options, context);
            return (p.__returned = p);
        }
        else {
            // in cache, maybe already fetching
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v)) {
                const stale = allowStale && v.__staleWhileFetching !== undefined;
                if (status) {
                    status.fetch = 'inflight';
                    if (stale)
                        status.returnedStale = true;
                }
                return stale ? v.__staleWhileFetching : (v.__returned = v);
            }
            // if we force a refresh, that means do NOT serve the cached value,
            // unless we are already in the process of refreshing the cache.
            const isStale = this.#isStale(index);
            if (!forceRefresh && !isStale) {
                if (status)
                    status.fetch = 'hit';
                this.#moveToTail(index);
                if (updateAgeOnGet) {
                    this.#updateItemAge(index);
                }
                if (status)
                    this.#statusTTL(status, index);
                return v;
            }
            // ok, it is stale or a forced refresh, and not already fetching.
            // refresh the cache.
            const p = this.#backgroundFetch(k, index, options, context);
            const hasStale = p.__staleWhileFetching !== undefined;
            const staleVal = hasStale && allowStale;
            if (status) {
                status.fetch = isStale ? 'stale' : 'refresh';
                if (staleVal && isStale)
                    status.returnedStale = true;
            }
            return staleVal ? p.__staleWhileFetching : (p.__returned = p);
        }
    }
    /**
     * Return a value from the cache. Will update the recency of the cache
     * entry found.
     *
     * If the key is not found, get() will return `undefined`.
     */
    get(k, getOptions = {}) {
        const { allowStale = this.allowStale, updateAgeOnGet = this.updateAgeOnGet, noDeleteOnStaleGet = this.noDeleteOnStaleGet, status, } = getOptions;
        const index = this.#keyMap.get(k);
        if (index !== undefined) {
            const value = this.#valList[index];
            const fetching = this.#isBackgroundFetch(value);
            if (status)
                this.#statusTTL(status, index);
            if (this.#isStale(index)) {
                if (status)
                    status.get = 'stale';
                // delete only if not an in-flight background fetch
                if (!fetching) {
                    if (!noDeleteOnStaleGet) {
                        this.delete(k);
                    }
                    if (status && allowStale)
                        status.returnedStale = true;
                    return allowStale ? value : undefined;
                }
                else {
                    if (status &&
                        allowStale &&
                        value.__staleWhileFetching !== undefined) {
                        status.returnedStale = true;
                    }
                    return allowStale ? value.__staleWhileFetching : undefined;
                }
            }
            else {
                if (status)
                    status.get = 'hit';
                // if we're currently fetching it, we don't actually have it yet
                // it's not stale, which means this isn't a staleWhileRefetching.
                // If it's not stale, and fetching, AND has a __staleWhileFetching
                // value, then that means the user fetched with {forceRefresh:true},
                // so it's safe to return that value.
                if (fetching) {
                    return value.__staleWhileFetching;
                }
                this.#moveToTail(index);
                if (updateAgeOnGet) {
                    this.#updateItemAge(index);
                }
                return value;
            }
        }
        else if (status) {
            status.get = 'miss';
        }
    }
    #connect(p, n) {
        this.#prev[n] = p;
        this.#next[p] = n;
    }
    #moveToTail(index) {
        // if tail already, nothing to do
        // if head, move head to next[index]
        // else
        //   move next[prev[index]] to next[index] (head has no prev)
        //   move prev[next[index]] to prev[index]
        // prev[index] = tail
        // next[tail] = index
        // tail = index
        if (index !== this.#tail) {
            if (index === this.#head) {
                this.#head = this.#next[index];
            }
            else {
                this.#connect(this.#prev[index], this.#next[index]);
            }
            this.#connect(this.#tail, index);
            this.#tail = index;
        }
    }
    /**
     * Deletes a key out of the cache.
     * Returns true if the key was deleted, false otherwise.
     */
    delete(k) {
        let deleted = false;
        if (this.#size !== 0) {
            const index = this.#keyMap.get(k);
            if (index !== undefined) {
                deleted = true;
                if (this.#size === 1) {
                    this.clear();
                }
                else {
                    this.#removeItemSize(index);
                    const v = this.#valList[index];
                    if (this.#isBackgroundFetch(v)) {
                        v.__abortController.abort(new Error('deleted'));
                    }
                    else if (this.#hasDispose || this.#hasDisposeAfter) {
                        if (this.#hasDispose) {
                            this.#dispose?.(v, k, 'delete');
                        }
                        if (this.#hasDisposeAfter) {
                            this.#disposed?.push([v, k, 'delete']);
                        }
                    }
                    this.#keyMap.delete(k);
                    this.#keyList[index] = undefined;
                    this.#valList[index] = undefined;
                    if (index === this.#tail) {
                        this.#tail = this.#prev[index];
                    }
                    else if (index === this.#head) {
                        this.#head = this.#next[index];
                    }
                    else {
                        const pi = this.#prev[index];
                        this.#next[pi] = this.#next[index];
                        const ni = this.#next[index];
                        this.#prev[ni] = this.#prev[index];
                    }
                    this.#size--;
                    this.#free.push(index);
                }
            }
        }
        if (this.#hasDisposeAfter && this.#disposed?.length) {
            const dt = this.#disposed;
            let task;
            while ((task = dt?.shift())) {
                this.#disposeAfter?.(...task);
            }
        }
        return deleted;
    }
    /**
     * Clear the cache entirely, throwing away all values.
     */
    clear() {
        for (const index of this.#rindexes({ allowStale: true })) {
            const v = this.#valList[index];
            if (this.#isBackgroundFetch(v)) {
                v.__abortController.abort(new Error('deleted'));
            }
            else {
                const k = this.#keyList[index];
                if (this.#hasDispose) {
                    this.#dispose?.(v, k, 'delete');
                }
                if (this.#hasDisposeAfter) {
                    this.#disposed?.push([v, k, 'delete']);
                }
            }
        }
        this.#keyMap.clear();
        this.#valList.fill(undefined);
        this.#keyList.fill(undefined);
        if (this.#ttls && this.#starts) {
            this.#ttls.fill(0);
            this.#starts.fill(0);
        }
        if (this.#sizes) {
            this.#sizes.fill(0);
        }
        this.#head = 0;
        this.#tail = 0;
        this.#free.length = 0;
        this.#calculatedSize = 0;
        this.#size = 0;
        if (this.#hasDisposeAfter && this.#disposed) {
            const dt = this.#disposed;
            let task;
            while ((task = dt?.shift())) {
                this.#disposeAfter?.(...task);
            }
        }
    }
}
//# sourceMappingURL=index.js.map
;// CONCATENATED MODULE: ./domain-whois.ts





function daysToMilliseconds(days) {
    return days * 86400000;
}
function daysBetweenDates(d1, d2) {
    return Math.round(Math.abs(d1.getTime() - d2.getTime()) / (1000 * 3600 * 24));
}
function daysFromDateToNow(date) {
    const now = new Date();
    return daysBetweenDates(now, date);
}
class TenuredDomainCache {
    constructor(ttlDaysArg, maxSizeArg) {
        this.ttlDaysArg = ttlDaysArg;
        this.maxSizeArg = maxSizeArg;
        let maxSize = 4096;
        let ttlDays = 7;
        if (ttlDaysArg !== undefined) {
            ttlDays = ttlDaysArg;
        }
        if (maxSizeArg !== undefined) {
            maxSize = maxSizeArg;
        }
        this.cache = new LRUCache({
            max: maxSize,
            ttl: daysToMilliseconds(ttlDays)
        });
        log_log(`Created TenuredDomainCache with size ${maxSize}, TTL: ${ttlDays} days`);
    }
    clear() {
        this.cache.clear();
    }
    has(domain) {
        return this.cache.has(domain);
    }
    add(domain) {
        this.cache.set(domain, true);
    }
}
const domainWhoisPath = "/identity-protection/domain-whois/";
class DomainWhoisRequester {
    constructor(configNotifier) {
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (maybe_some(config.threatCloudOrigin) && maybe_some(config.threatCloudAuthParam)) {
            this.requestUrlBase = config.threatCloudOrigin + domainWhoisPath + config.threatCloudAuthParam;
        }
        else {
            this.requestUrlBase = undefined;
        }
    }
    async getCreatedDateAgeDays(url) {
        return new Promise((resolve, reject) => {
            if (maybe_none(this.requestUrlBase)) {
                logError("DomainWhoisRequester: request URL is undefined");
                reject();
            }
            const urlObject = new URL(url);
            const requestUrl = this.requestUrlBase + "&domains=" + encodeURIComponent(urlObject.hostname) + "&fields=createddate&validate=1";
            fetch(requestUrl).then(response => {
                switch (response.status) {
                    case 200:
                        return response.json();
                    default:
                        throw new Error(`DomainWhoisRequester: server status: ${response.status}`);
                }
            }).then(responseJson => {
                var _a;
                const domainsData = responseJson.domains;
                if (Object.keys(domainsData).length < 1) {
                    logError(`DomainWhoisRequester: bad data (no domains) returned for ${requestUrl}`);
                    reject();
                    return;
                }
                const domainName = Object.keys(domainsData)[0];
                if (!domainsData[domainName].hasOwnProperty('createddate')) {
                    logError(`DomainWhoisRequester: bad data (no createddate) returned for ${requestUrl}`);
                    reject();
                    return;
                }
                const domainData = domainsData[domainName];
                const domainInfo = {
                    createddate: (_a = domainData.createddate) !== null && _a !== void 0 ? _a : null,
                };
                if (domainInfo.createddate === null) {
                    logError(`No createddate for ${url}`);
                    reject();
                    return;
                }
                const domainAgeCreatedDate = new Date(domainInfo.createddate);
                if (isNaN(domainAgeCreatedDate.getTime())) {
                    logError(`${domainInfo.createddate} is not a valid createddate for ${url}`);
                    reject();
                    return;
                }
                else {
                    const days = daysFromDateToNow(domainAgeCreatedDate);
                    log_log(`Domain ${urlObject.hostname} (URL ${url}) createddate: ${domainInfo.createddate}`);
                    resolve(days);
                }
            }).catch(error => {
                logError(`DomainWhoisRequester: fetch error: ${string_utils_toString(error)}`);
                reject();
            });
        });
    }
}

;// CONCATENATED MODULE: ../lib/common/sorting-list-label-machine.ts



class BlockedPattern {
    constructor(pattern) {
        try {
            this.regex = new RegExp(pattern, "i");
        }
        catch (e) {
            logError(e);
        }
    }
    test(urlSpec) {
        if (maybe_some(this.regex)) {
            return this.regex.test(urlSpec);
        }
        else {
            return false;
        }
    }
}
class DomainFilter {
    constructor(listEntry) {
        this.blockedPatterns = [];
        this.isAllowed = false;
        this.isAllowed = listEntry.whitelisted;
        this.blockedPatterns = listEntry.blacklistedPatterns.filter(pattern => pattern.length > 0)
            .map(pattern => new BlockedPattern(pattern));
    }
    categorise(url) {
        for (const blockedPattern of this.blockedPatterns) {
            if (blockedPattern.test(url.href)) {
                return IPPageCategory.Blocked;
            }
        }
        return this.isAllowed ? IPPageCategory.Allowed : IPPageCategory.Unknown;
    }
}
class CloudSortingListLabelMachine {
    constructor(cloudList) {
        this.domainFilters = new Map();
        this.add(cloudList);
    }
    add(cloudList) {
        cloudList.domains.forEach(domainEntry => {
            this.domainFilters.set(domainEntry.domain, new DomainFilter(domainEntry));
        });
    }
    delete(hostname) {
        this.domainFilters.delete(hostname);
    }
    runFilter(hostname, url) {
        var _a, _b;
        return (_b = (_a = this.domainFilters.get(hostname)) === null || _a === void 0 ? void 0 : _a.categorise(url)) !== null && _b !== void 0 ? _b : IPPageCategory.Unknown;
    }
    categorise(url) {
        let hostnameParts = url.hostname.split(".");
        let hasBeenAllowed = false;
        while (hostnameParts.length > 0) {
            const hostnameToCheck = hostnameParts.join(".");
            hostnameParts.shift();
            const category = this.runFilter(hostnameToCheck, url);
            switch (category) {
                case IPPageCategory.Blocked:
                    return category;
                case IPPageCategory.Allowed:
                    hasBeenAllowed = true;
                    break;
                case IPPageCategory.Unknown:
                    break;
                default:
                    break;
            }
        }
        return hasBeenAllowed ? IPPageCategory.Allowed : IPPageCategory.Unknown;
    }
}

;// CONCATENATED MODULE: ../lib/common/phishing-sorting-lists.ts














var IPSortingList;
(function (IPSortingList) {
    IPSortingList[IPSortingList["HTTPBlocker"] = 0] = "HTTPBlocker";
    IPSortingList[IPSortingList["CustomerBEC"] = 1] = "CustomerBEC";
    IPSortingList[IPSortingList["HPCloud"] = 2] = "HPCloud";
    IPSortingList[IPSortingList["Endpoint"] = 3] = "Endpoint";
    IPSortingList[IPSortingList["User"] = 4] = "User";
    IPSortingList[IPSortingList["FileUrl"] = 5] = "FileUrl";
    IPSortingList[IPSortingList["DomainAge"] = 6] = "DomainAge";
})(IPSortingList || (IPSortingList = {}));
const IPSortingListcount = Object.keys(IPSortingList).filter(k => !isNaN(Number(k))).length;
class SortingListBase {
    constructor(type, onCategorisedCallback) {
        this.type = type;
        this.onCategorisedCallback = onCategorisedCallback;
    }
    onCategorised(categoriesOrUrl, urlInfo) {
        if (categoriesOrUrl instanceof Map) {
            for (const [urlSpec, category] of categoriesOrUrl) {
                this.onCategorisedCallback({ category, list: this.type, urlSpec });
            }
        }
        else if (maybe_some(urlInfo)) {
            const category = urlInfo.category;
            const domainAgeDays = urlInfo.domainAgeDays;
            const domainAgeDaysThreshold = urlInfo.domainAgeDaysThreshold;
            this.onCategorisedCallback({ category, list: this.type, urlSpec: categoriesOrUrl, domainAgeDays, domainAgeDaysThreshold });
        }
    }
}
class HTTPBlockerSortingList extends SortingListBase {
    constructor(configNotifier, onCategorisedCallback) {
        super(IPSortingList.HTTPBlocker, onCategorisedCallback);
        this.treatHttpAsBlocked = false;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.treatHttpAsBlocked = config.identityProtection.config.treatHttpAsBlocked;
        }
        else {
            this.treatHttpAsBlocked = false;
        }
    }
    categorise(url) {
        if (this.treatHttpAsBlocked && url.protocol === Scheme.HTTP) {
            return IPPageCategory.Blocked;
        }
        else {
            return IPPageCategory.Unknown;
        }
    }
    clearWaitingList() { }
}
class DomainAgeSortingList extends SortingListBase {
    constructor(configNotifier, onCategorisedCallback) {
        super(IPSortingList.DomainAge, onCategorisedCallback);
        this.idGenerator = new IdGenerator();
        this.waitingList = new Map();
        this.enabled = false;
        this.minDays = 30;
        this.domainWhoisRequester = new DomainWhoisRequester(configNotifier);
        this.tenuredDomainCache = new TenuredDomainCache();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            const ipConfig = config.identityProtection.config;
            if (this.minDays != ipConfig.domainAgeCheckMinDays) {
                log_log('DomainAgeSortingList clearing tenured domain cache due to change in domain age threshold');
                this.tenuredDomainCache.clear();
            }
            this.enabled = ipConfig.domainAgeCheckEnabled;
            this.minDays = ipConfig.domainAgeCheckMinDays;
            if (!this.enabled) {
                log_log('Domain age checking for identity protection explicitly disabled');
            }
            else {
                log_log(`Domain age checking for identity protection enabled, threshold: ${this.minDays} days`);
            }
        }
        else {
            log_log('Identity protection disabled; disabling domain age checking');
            this.tenuredDomainCache.clear();
            this.enabled = false;
        }
    }
    categorise(url) {
        if (isFileUrl(url) || !this.enabled) {
            return IPPageCategory.Unknown;
        }
        const domain = url.hostname;
        if (this.tenuredDomainCache.has(domain)) {
            return IPPageCategory.Unknown;
        }
        const id = this.idGenerator.generateId();
        this.waitingList.set(id, url.href);
        this.domainWhoisRequester.getCreatedDateAgeDays(url.toString()).then(domainAgeDays => {
            const domainAgeDaysThreshold = this.minDays;
            log_log(`Domain ${domain} (url ${url}) is ${domainAgeDays} days old; configured minimum threshold: ${domainAgeDaysThreshold}`);
            if (domainAgeDays < domainAgeDaysThreshold) {
                this.onCategorised(url.href, { category: IPPageCategory.Blocked, domainAgeDays, domainAgeDaysThreshold });
            }
            else {
                this.tenuredDomainCache.add(domain);
                this.onCategorised(url.href, { category: IPPageCategory.Unknown, domainAgeDays, domainAgeDaysThreshold });
            }
            this.waitingList.delete(id);
        }).catch(() => {
            logError(`Failed to lookup creation date for ${domain} (url ${url})`);
        });
        return undefined;
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}
class EndpointSortingList extends SortingListBase {
    constructor(messageRouter, hostHelperMessageSender, onCategorisedCallback) {
        super(IPSortingList.Endpoint, onCategorisedCallback);
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.idGenerator = new IdGenerator();
        this.waitingList = new Map();
        messageRouter.registerMessagePayloadHandler(MessageType.phishingCategoryResponseV22, message => this.onCategoryResponse(message));
    }
    onCategoryResponse(payload) {
        const urlSpec = this.waitingList.get(payload.id);
        if (maybe_some(urlSpec)) {
            this.onCategorised(urlSpec, { category: payload.category });
            this.waitingList.delete(payload.id);
        }
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        const queryUrl = url.href;
        const id = this.idGenerator.generateId();
        this.waitingList.set(id, queryUrl);
        this.hostHelperMessageSender.sendMessage(MessageType.phishingCategoryRequestV22, new PhishingCategoryRequestV22(id, queryUrl));
        return undefined;
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}
class UserSortingList extends SortingListBase {
    constructor(configNotifier, hostHelperMessageSender, onCategorisedCallback) {
        super(IPSortingList.User, onCategorisedCallback);
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.allowUserToEnableInput = false;
        this.userAllowedHosts = new Set();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            const ipConfig = config.identityProtection.config;
            this.allowUserToEnableInput = ipConfig.allowUserToEnableInput;
            this.operationMode = ipConfig.operationMode;
            this.userAllowedHosts = new Set(ipConfig.userAllowedHosts);
        }
        else {
            this.allowUserToEnableInput = false;
        }
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        const isUserListActive = this.allowUserToEnableInput && isInputAllowableOpMode(this.operationMode);
        if (isUserListActive && this.userAllowedHosts.has(url.hostname)) {
            return IPPageCategory.UserAllowed;
        }
        else {
            return IPPageCategory.Unknown;
        }
    }
    clearWaitingList() { }
    allowHostnames(toAllow) {
        this.changeHostStatus(toAllow, true);
    }
    disallowHostnames(toDisallow) {
        this.changeHostStatus(toDisallow, false);
    }
    changeHostStatus(items, allowInput) {
        const hostnames = items.map(item => isURL(item) ? item.hostname : item);
        if (allowInput) {
            log_log(`UserSortingList: User added ${string_utils_toString(hostnames)} to list`);
            hostnames.forEach(hostname => this.userAllowedHosts.add(hostname));
        }
        else {
            log_log(`UserSortingList: User removed ${string_utils_toString(hostnames)} from list`);
            hostnames.forEach(hostname => this.userAllowedHosts.delete(hostname));
        }
        this.hostHelperMessageSender.sendMessage(MessageType.phishingHostStatusChangeV22, new PhishingHostStatusChangeV22(hostnames, allowInput));
    }
}
const credentialProtectionUrlListPath = "/deviceapi/credential-protection-url-list/";
const urlClassificationPath = "/identity-protection/url-classification/";
var Classification;
(function (Classification) {
    Classification[Classification["unknown"] = 0] = "unknown";
    Classification[Classification["allowed"] = 1] = "allowed";
    Classification[Classification["blocked"] = 2] = "blocked";
})(Classification || (Classification = {}));
class CloudSortingListBase extends SortingListBase {
    constructor(type, onCategorisedCallback, serverOriginUrl, listPath, authParam) {
        super(type, onCategorisedCallback);
        this.authParam = authParam;
        this.identifier = `CloudSortingList ${IPSortingList[this.type]}`;
        this.requestUrlBase = serverOriginUrl.origin + listPath;
    }
    static get emptyList() {
        return {
            "version": "0.0.0",
            "lastUpdated": 0,
            "domains": [],
            "urls": {}
        };
    }
    get serverOrigin() { return new URL(this.requestUrlBase).origin; }
    fetch(listTimestamp, url) {
        let requestUrl = this.requestUrlBase;
        if (maybe_some(this.authParam)) {
            requestUrl += this.authParam;
        }
        if (maybe_some(url)) {
            log_log(`${this.identifier}: Fetching list for "${url}"`);
            requestUrl += "&urls=" + encodeURIComponent(url);
        }
        const listDate = new Date(listTimestamp);
        const options = { method: "GET" };
        if (!isNaN(listDate.getTime()) && 0 !== listDate.valueOf()) {
            options.headers = { "If-Modified-Since": listDate.toUTCString() };
        }
        fetch(requestUrl, options).then(response => {
            switch (response.status) {
                case 200:
                    log_log(`${this.identifier}: New list available from server`);
                    return response.json();
                case 304:
                    log_log(`${this.identifier}: Already have latest list`);
                    return undefined;
                default:
                    logError(`${this.identifier}: Server status: ${response.status}`);
                    return undefined;
            }
        }).then(responseJson => {
            if (maybe_some(responseJson)) {
                this.onListReceived(responseJson, url);
            }
            else {
                this.onListNotReceived(url);
            }
        }).catch(error => {
            logError(`${this.identifier}: Server error: ${string_utils_toString(error)}`);
            this.onListNotReceived(url);
        });
    }
}
class CustomerBecSortingList extends CloudSortingListBase {
    constructor(serverOriginUrl, alarmManager, onCategorisedCallback) {
        super(IPSortingList.CustomerBEC, onCategorisedCallback, serverOriginUrl, credentialProtectionUrlListPath);
        this.rawList = CloudSortingListBase.emptyList;
        this.labelMachine = new CloudSortingListLabelMachine(CloudSortingListBase.emptyList);
        this.waitingList = new Set();
        this.hasList = false;
        const key = StorageKey.customerList;
        chrome.storage.local.get(key, result => {
            const storedValue = result[key];
            if (maybe_some(storedValue)) {
                this.rawList = storedValue;
                this.labelMachine = new CloudSortingListLabelMachine(this.rawList);
                this.processWaitingList();
            }
            this.fetch(this.rawList.lastUpdated);
            alarmManager.registerPeriodicAlarm(AlarmName.customerBecListFetch, 30, () => this.fetch(this.rawList.lastUpdated));
        });
    }
    onListReceived(newList) {
        this.rawList = newList;
        this.labelMachine = new CloudSortingListLabelMachine(this.rawList);
        chrome.storage.local.set({ [StorageKey.customerList]: this.rawList });
        this.processWaitingList();
    }
    onListNotReceived() {
        this.processWaitingList();
    }
    processWaitingList() {
        this.hasList = true;
        if (this.waitingList.size > 0) {
            const categories = new Map();
            this.waitingList.forEach(urlSpec => categories.set(urlSpec, this.categorise(new URL(urlSpec))));
            this.waitingList.clear();
            this.onCategorised(categories);
        }
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        if (this.hasList) {
            return this.labelMachine.categorise(url);
        }
        else {
            this.waitingList.add(url.href);
            return undefined;
        }
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}
class HpCloudMetaData {
    constructor(timestamp) {
        this.timestamp = timestamp;
    }
}
class HpCloudSortingList extends CloudSortingListBase {
    constructor(authParam, alarmManager, onCategorisedCallback, overrideBrClServerUrl) {
        const serverOriginUrl = overrideBrClServerUrl !== null && overrideBrClServerUrl !== void 0 ? overrideBrClServerUrl : HpCloudSortingList.defaultOriginUrl;
        super(IPSortingList.HPCloud, onCategorisedCallback, serverOriginUrl, urlClassificationPath, authParam);
        alarmManager.registerPeriodicAlarm(AlarmName.hpCloudListClearDeadEntries, HpCloudSortingList.ttlMins, () => this.clearDeadEntries());
        this.cache = new Map();
        this.waitingUrlSpecs = new Set();
        this.waitingOriginAndPaths = new Set();
        this.lastVersion = CloudSortingListBase.emptyList.version;
    }
    static get ttlMins() { return 5; }
    static get ttl() { return HpCloudSortingList.ttlMins * 60 * 1000; }
    static get defaultOriginUrl() { return new URL("https://brcl-sureclick.bromium-online.com"); }
    get version() { return this.lastVersion; }
    isEntryAlive(entry) {
        if (maybe_some(entry)) {
            return HpCloudSortingList.ttl > (Date.now() - entry.metadata.timestamp);
        }
        return false;
    }
    getTimestamp(entry) {
        var _a;
        return (_a = entry === null || entry === void 0 ? void 0 : entry.metadata.timestamp) !== null && _a !== void 0 ? _a : 0;
    }
    clearDeadEntries() {
        const deadEntries = new Set();
        const now = Date.now();
        for (const [originAndPath, entry] of this.cache) {
            if (HpCloudSortingList.ttl < now - entry.metadata.timestamp && !this.waitingOriginAndPaths.has(originAndPath)) {
                deadEntries.add(originAndPath);
            }
        }
        for (const key of deadEntries) {
            this.cache.delete(key);
        }
    }
    onListReceived(newList, queriedOriginAndPath) {
        var _a;
        if (maybe_none(queriedOriginAndPath)) {
            logError("HpCloudSortingList: list recieved without a queried URL");
            return;
        }
        const metadata = new HpCloudMetaData(Date.now());
        let cacheEntry = this.cache.get(queriedOriginAndPath);
        const classification = (_a = newList.urls[queriedOriginAndPath]) !== null && _a !== void 0 ? _a : newList.urls[queriedOriginAndPath.toLowerCase()];
        if (maybe_some(classification)) {
            cacheEntry = { classification, metadata };
            this.cache.set(queriedOriginAndPath, cacheEntry);
        }
        else {
            if (maybe_some(cacheEntry)) {
                cacheEntry.metadata = metadata;
            }
            else {
                logError(`HpCloudSortingList: unexpected response missing the queried URL: ${string_utils_toString(newList)}`);
            }
        }
        this.waitingOriginAndPaths.delete(queriedOriginAndPath);
        this.lastVersion = newList.version;
        const category = maybe_some(cacheEntry) ? this.getCategory(cacheEntry.classification) : IPPageCategory.Unknown;
        const categories = new Map();
        for (const urlSpec of this.waitingUrlSpecs) {
            const url = new URL(urlSpec);
            if (this.getOriginAndPath(url) !== queriedOriginAndPath) {
                continue;
            }
            categories.set(urlSpec, category);
        }
        for (let urlSpec of categories.keys()) {
            this.waitingUrlSpecs.delete(urlSpec);
        }
        this.onCategorised(categories);
    }
    onListNotReceived(queriedOriginAndPath) {
        this.onListReceived(CloudSortingListBase.emptyList, queriedOriginAndPath);
    }
    categorise(url) {
        if (isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        const originAndPath = this.getOriginAndPath(url);
        const existingEntry = this.cache.get(originAndPath);
        if (this.isEntryAlive(existingEntry)) {
            return this.getCategory(existingEntry.classification);
        }
        this.waitingUrlSpecs.add(url.href);
        if (!this.waitingOriginAndPaths.has(originAndPath)) {
            this.waitingOriginAndPaths.add(originAndPath);
            this.fetch(this.getTimestamp(existingEntry), originAndPath);
        }
        return undefined;
    }
    clearWaitingList() {
        this.waitingOriginAndPaths.clear();
        this.waitingUrlSpecs.clear();
    }
    getCategory(classification) {
        switch (classification.classification) {
            case Classification.unknown:
                return IPPageCategory.Unknown;
            case Classification.allowed:
                return IPPageCategory.Allowed;
            case Classification.blocked:
                return IPPageCategory.Blocked;
            default:
                logError(`HpCloudSortingList: Invalid classification: ${string_utils_toString(classification)}`);
                return IPPageCategory.Unknown;
        }
    }
    getOriginAndPath(url) {
        return url.origin + url.pathname;
    }
}
class FileUrlSortingList extends SortingListBase {
    constructor(configNotifier, fileUrlTracker, onCategorisedCallback) {
        super(IPSortingList.FileUrl, onCategorisedCallback);
        this.fileUrlTracker = fileUrlTracker;
        this.sbxSecureBrowserMode = false;
        this.treatFileUrlsAsBlocked = false;
        this.treatFileUrlsAsTrusted = false;
        this.waitingList = new Set();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.treatFileUrlsAsBlocked = config.identityProtection.config.treatFileAsBlocked;
            this.treatFileUrlsAsTrusted = config.identityProtection.config.treatFileUrlsAsTrusted;
        }
        else {
            this.treatFileUrlsAsBlocked = false;
            this.treatFileUrlsAsTrusted = false;
        }
        this.sbxSecureBrowserMode = config.sbxSecureBrowserMode;
    }
    onQueryComplete(url, isTrusted) {
        const urlSpec = url.href;
        if (this.waitingList.has(urlSpec)) {
            this.onCategorised(urlSpec, { category: isTrusted ? IPPageCategory.Allowed : IPPageCategory.Blocked });
            this.waitingList.delete(urlSpec);
        }
    }
    categorise(url) {
        if (!isFileUrl(url)) {
            return IPPageCategory.Unknown;
        }
        if (this.treatFileUrlsAsBlocked) {
            return IPPageCategory.Blocked;
        }
        else if (this.treatFileUrlsAsTrusted) {
            log_log("Forcing file URL to be allowed by configuration.");
            return IPPageCategory.Allowed;
        }
        else if (this.sbxSecureBrowserMode) {
            return IPPageCategory.Blocked;
        }
        this.waitingList.add(url.href);
        this.fileUrlTracker.queryFileUrlTrustedness(url, (url, isTrusted) => this.onQueryComplete(url, isTrusted));
        return undefined;
    }
    clearWaitingList() {
        this.waitingList.clear();
    }
}

;// CONCATENATED MODULE: ../lib/common/phishing-category-tracker.ts







class CategoryDetails {
    constructor(category, list, domainAgeDays, domainAgeDaysThreshold) {
        this.category = category;
        this.list = list;
        this.domainAgeDays = domainAgeDays;
        this.domainAgeDaysThreshold = domainAgeDaysThreshold;
    }
    source() {
        switch (this.list) {
            case IPSortingList.DomainAge:
                return "cloudDomainAge";
            case IPSortingList.HTTPBlocker:
                return "config_treatHttpPagesAsBlacklisted";
            case IPSortingList.CustomerBEC:
                return "customerList";
            case IPSortingList.HPCloud:
                return "cloudPhishingList";
            case IPSortingList.Endpoint:
                return "trustedSite";
            case IPSortingList.User:
                return "userList";
            case IPSortingList.FileUrl:
                return "fileUrlList";
            case undefined:
                return "none";
        }
    }
    equals(other) {
        return maybe_some(other) && this.category === other.category && this.list === other.list && this.domainAgeDays === other.domainAgeDays && this.domainAgeDaysThreshold === other.domainAgeDaysThreshold;
    }
}
class WaitingItem {
    constructor(callback) {
        this._callbacks = [];
        this.listResults = new Array(IPSortingListcount).fill(undefined);
        this.addCallback(callback);
    }
    addCallback(callback) {
        this._callbacks.push(callback);
    }
    get callbacks() {
        return this._callbacks;
    }
    getCategory() {
        const overridingAllowedResult = this.listResults.find(r => maybe_some(r) && r.category === IPPageCategory.Allowed
            && (r.list === IPSortingList.Endpoint || r.list === IPSortingList.CustomerBEC));
        if (maybe_some(overridingAllowedResult)) {
            return { categoryDetails: overridingAllowedResult, final: true };
        }
        const hasAllResults = this.listResults.every(maybe_some);
        if (hasAllResults && this.listResults.every(r => r.category === IPPageCategory.Unknown)) {
            return { categoryDetails: new CategoryDetails(IPPageCategory.Unknown), final: true };
        }
        const blockedResult = this.listResults.find(r => maybe_some(r) && r.category === IPPageCategory.Blocked);
        if (maybe_some(blockedResult)) {
            return { categoryDetails: blockedResult, final: hasAllResults };
        }
        const allowedResult = this.listResults.find(r => maybe_some(r)
            && (r.category === IPPageCategory.Allowed || r.category === IPPageCategory.UserAllowed));
        return { categoryDetails: allowedResult, final: hasAllResults };
    }
    update(list, category, domainAgeDays, domainAgeDaysThreshold) {
        this.listResults[list] = new CategoryDetails(category, list, domainAgeDays, domainAgeDaysThreshold);
    }
}
class PhishingCategoryTracker {
    constructor(configNotifier, messageRouter, hostHelperMessageSender, alarmManager, fileUrlTracker, onConfigured) {
        this.configNotifier = configNotifier;
        this.messageRouter = messageRouter;
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.alarmManager = alarmManager;
        this.fileUrlTracker = fileUrlTracker;
        this.listsCreated = false;
        this.fullyConfigured = false;
        this.enabled = false;
        this.lists = new Map();
        this.waitingUrlSpecs = new Map();
        this.onCategorised = event => this.onNewCategoryAvailable(event);
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        onConfigured.registerListener(() => {
            this.fullyConfigured = true;
            this.tryCreateLists();
        });
    }
    get cloudListVersion() {
        var _a, _b;
        return (_b = (_a = this.cloudList) === null || _a === void 0 ? void 0 : _a.version) !== null && _b !== void 0 ? _b : "0.0.0";
    }
    tryCreateLists() {
        if (this.listsCreated || !this.enabled || maybe_none(this.config)) {
            return;
        }
        const becUrl = url_utils_parseUrl(this.config.customerBecUrl);
        if (maybe_some(becUrl)) {
            this.addList(new CustomerBecSortingList(becUrl, this.alarmManager, this.onCategorised));
        }
        else {
            logError(`Invalid BEC URL: "${this.config.customerBecUrl}"`);
        }
        if (this.config.enableCloudService) {
            const cloudUrl = url_utils_parseUrl(this.config.cloudUrl);
            if (maybe_none(cloudUrl)) {
                logError(`Invalid cloud override URL: "${this.config.cloudUrl}"`);
            }
            this.addList(new HpCloudSortingList(this.config.cloudAuth, this.alarmManager, this.onCategorised, cloudUrl));
            this.addList(new DomainAgeSortingList(this.configNotifier, this.onCategorised));
        }
        else {
            log_log("Cloud service disabled");
        }
        this.addList(new EndpointSortingList(this.messageRouter, this.hostHelperMessageSender, this.onCategorised));
        this.addList(new HTTPBlockerSortingList(this.configNotifier, this.onCategorised));
        this.addList(new UserSortingList(this.configNotifier, this.hostHelperMessageSender, this.onCategorised));
        this.addList(new FileUrlSortingList(this.configNotifier, this.fileUrlTracker, this.onCategorised));
        this.listsCreated = true;
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.config = config.identityProtection.config;
            this.enabled = true;
            if (this.fullyConfigured) {
                this.tryCreateLists();
                this.updateCloudServers(config.identityProtection.config);
            }
        }
        else {
            this.enabled = false;
            for (const list of this.lists.values()) {
                list.clearWaitingList();
            }
        }
    }
    updateCloudServers(config) {
        var _a, _b;
        const newBecUrl = url_utils_parseUrl(config.customerBecUrl);
        if (maybe_some(newBecUrl)) {
            if (((_a = this.customerBecList) === null || _a === void 0 ? void 0 : _a.serverOrigin) !== newBecUrl.origin) {
                this.customerBecList = new CustomerBecSortingList(newBecUrl, this.alarmManager, this.onCategorised);
            }
        }
        else {
            logError(`New BEC URL is invalid: "${config.customerBecUrl}"`);
            this.customerBecList = undefined;
        }
        if (config.enableCloudService) {
            const newCloudUrl = url_utils_parseUrl(config.cloudUrl);
            if (maybe_none(newCloudUrl)) {
                logError(`New cloud override URL is invalid: "${config.cloudUrl}"`);
                this.cloudList = new HpCloudSortingList(config.cloudAuth, this.alarmManager, this.onCategorised);
            }
            else if (((_b = this.cloudList) === null || _b === void 0 ? void 0 : _b.serverOrigin) !== newCloudUrl.origin) {
                this.cloudList = new HpCloudSortingList(config.cloudAuth, this.alarmManager, this.onCategorised, newCloudUrl);
            }
        }
        else {
            this.cloudList = undefined;
        }
    }
    logCategory(listType, urlSpec, category) {
        if (maybe_some(category)) {
            log_log(`${IPSortingList[listType]} classified ${urlSpec} as ${IPPageCategory[category]}`);
        }
    }
    logCategoryDetails(urlSpec, categoryDetails, final) {
        if (maybe_some(categoryDetails)) {
            const categoryString = IPPageCategory[categoryDetails.category];
            log_log(`The ${final ? "final" : "provisional"} overall category for ${urlSpec} is ${categoryString}`);
        }
    }
    onNewCategoryAvailable(event) {
        const waitingItem = this.waitingUrlSpecs.get(event.urlSpec);
        if (maybe_none(waitingItem)) {
            return;
        }
        this.logCategory(event.list, event.urlSpec, event.category);
        waitingItem.update(event.list, event.category, event.domainAgeDays, event.domainAgeDaysThreshold);
        const { categoryDetails, final } = waitingItem.getCategory();
        this.logCategoryDetails(event.urlSpec, categoryDetails, final);
        if (maybe_some(categoryDetails)) {
            for (const callback of waitingItem.callbacks) {
                callback(categoryDetails);
            }
        }
        if (final) {
            this.waitingUrlSpecs.delete(event.urlSpec);
        }
    }
    consultLists(url, callback) {
        const waitingItem = new WaitingItem(callback);
        for (const list of this.lists.values()) {
            const category = list.categorise(url);
            this.logCategory(list.type, url.href, category);
            if (maybe_some(category)) {
                waitingItem.update(list.type, category, undefined, undefined);
            }
        }
        const { categoryDetails, final } = waitingItem.getCategory();
        this.logCategoryDetails(url.toString(), categoryDetails, final);
        if (!final) {
            this.waitingUrlSpecs.set(url.href, waitingItem);
        }
        return categoryDetails;
    }
    doCategorise(url, callback) {
        if (!this.enabled) {
            return undefined;
        }
        const waitingItem = this.waitingUrlSpecs.get(url.href);
        if (maybe_some(waitingItem)) {
            waitingItem.addCallback(callback);
            return undefined;
        }
        return this.consultLists(url, callback);
    }
    categorise(url, callback) {
        log_log(`Categorisation request for ${url.toString()}`);
        const categoryDetails = this.doCategorise(url, callback);
        if (maybe_some(categoryDetails)) {
            callback(categoryDetails);
        }
    }
    userAllowHostnames(toAllow) {
        const userList = this.userList;
        if (this.enabled && maybe_some(userList)) {
            userList.allowHostnames(toAllow);
        }
        else {
            logError(`Failed to user allow: ${string_utils_toString(toAllow)}`);
        }
    }
    userDisallowHostnames(toDisallow) {
        const userList = this.userList;
        if (this.enabled && maybe_some(userList)) {
            userList.disallowHostnames(toDisallow);
        }
        else {
            logError(`Failed to user disallow: ${string_utils_toString(toDisallow)}`);
        }
    }
    addList(list) {
        this.lists.set(list.type, list);
    }
    getList(key) {
        const list = this.lists.get(key);
        return maybe_some(list) ? list : undefined;
    }
    setList(key, newList) {
        if (maybe_some(newList)) {
            this.lists.set(key, newList);
        }
        else {
            this.lists.delete(key);
        }
    }
    get userList() {
        return this.getList(IPSortingList.User);
    }
    get cloudList() {
        return this.getList(IPSortingList.HPCloud);
    }
    set cloudList(newCloudList) {
        this.setList(IPSortingList.HPCloud, newCloudList);
    }
    get customerBecList() {
        return this.getList(IPSortingList.CustomerBEC);
    }
    set customerBecList(newCustomerBecList) {
        this.setList(IPSortingList.CustomerBEC, newCustomerBecList);
    }
}

// EXTERNAL MODULE: ../node_modules/qlobber/index.js
var qlobber = __webpack_require__(689);
// EXTERNAL MODULE: ../node_modules/ipaddr.js/lib/ipaddr.js
var ipaddr = __webpack_require__(483);
;// CONCATENATED MODULE: ../lib/common/ipaddress-utils.ts






class Netblock {
    constructor(scheme, cidrOrAddress, networkMask = 999) {
        this.scheme = scheme;
        if (isArray(cidrOrAddress)) {
            this.address = cidrOrAddress[0];
            this.networkMask = cidrOrAddress[1];
        }
        else {
            this.address = cidrOrAddress;
            this.networkMask = networkMask;
        }
    }
    toIPv4MappedNetblock() {
        if (isIPv4(this.address)) {
            return new Netblock(this.scheme, this.address.toIPv4MappedAddress(), this.networkMask + 96);
        }
        else {
            return this;
        }
    }
    toString() {
        if (maybe_some(this.scheme)) {
            return `${this.scheme}//${this.address.toString()}/${this.networkMask}`;
        }
        else {
            return `${this.address.toString()}/${this.networkMask}`;
        }
    }
}
const networkMaskRegex = /\/[0-9]{1,3}$/;
function isIPv4(address) {
    return address.kind() === "ipv4";
}
function parseIpAddress(address) {
    try {
        if (address[0] === "[" && address[address.length - 1] === "]") {
            address = address.substring(1, address.length - 1);
        }
        return (0,ipaddr.parse)(address);
    }
    catch (_a) {
        return undefined;
    }
}
function parseIpAddressFromOrigin(origin) {
    return parseIpAddress(origin.host);
}
function parseNetblock(spec, origin) {
    const scheme = origin === null || origin === void 0 ? void 0 : origin.scheme;
    try {
        if (maybe_some(origin)) {
            const match = spec.match(networkMaskRegex);
            if (match !== null && maybe_some(match[0])) {
                spec = origin.host + match[0];
            }
            else {
                spec = origin.host;
            }
        }
        if (spec[0] == "[" && spec.includes("]")) {
            spec = spec.substring(1).replace("]", "");
        }
        return new Netblock(scheme, (0,ipaddr.parseCIDR)(spec));
    }
    catch (_a) {
        const ip = parseIpAddress(spec);
        if (maybe_some(ip)) {
            return new Netblock(scheme, ip, isIPv4(ip) ? 32 : 128);
        }
    }
}
class OriginMatcherWithNetblockSupport {
    constructor() {
        this.originMatcher = new OriginMatcher();
        this.allowNetblocks = [];
        this.excludeNetblocks = [];
    }
    addOrigin(origin) {
        this.originMatcher.add(origin);
    }
    excludeOrigin(origin) {
        this.originMatcher.exclude(origin);
    }
    addNetblock(netblock) {
        this.allowNetblocks.push(netblock);
    }
    excludeNetblock(netblock) {
        this.excludeNetblocks.push(netblock);
    }
    has(origin) {
        if (this.originMatcher.isExcluded(origin)) {
            return false;
        }
        const ipAddress = parseIpAddressFromOrigin(origin);
        if (maybe_some(ipAddress)) {
            const longestExclude = this.testIpAddress(origin.scheme, ipAddress, this.excludeNetblocks);
            const longestAllow = this.testIpAddress(origin.scheme, ipAddress, this.allowNetblocks);
            if (maybe_some(longestExclude) && maybe_some(longestAllow)) {
                if (longestExclude === longestAllow) {
                    logError(`matchIpAddress: Conflicting longest netblocks for IP address ${ipAddress}`);
                    return false;
                }
                return longestAllow > longestExclude;
            }
            if (maybe_some(longestExclude)) {
                return false;
            }
            if (maybe_some(longestAllow)) {
                return true;
            }
        }
        return this.originMatcher.isAdded(origin);
    }
    testIpAddress(scheme, address, netblocks) {
        let longestMatch;
        for (const netblock of netblocks) {
            if (this.isIpAddressInNetblock(scheme, address, netblock)) {
                const matchLength = netblock.networkMask;
                if (maybe_none(longestMatch) || matchLength > longestMatch) {
                    longestMatch = matchLength;
                }
            }
        }
        return longestMatch;
    }
    isIpAddressInNetblock(scheme, address, netblock) {
        if (!this.schemeMatches(scheme, netblock)) {
            return false;
        }
        try {
            if (address.kind() !== netblock.address.kind()) {
                if (isIPv4(address)) {
                    return this.isIpAddressInNetblock(scheme, address.toIPv4MappedAddress(), netblock);
                }
                else {
                    return this.isIpAddressInNetblock(scheme, address, netblock.toIPv4MappedNetblock());
                }
            }
            return address.match(netblock.address, netblock.networkMask);
        }
        catch (e) {
            logError(e);
            return false;
        }
    }
    schemeMatches(scheme, netblock) {
        switch (netblock.scheme) {
            case undefined:
                return true;
            case Scheme.WILDCARD_ONE:
                return true;
            case Scheme.WILDCARD_SOME:
                return true;
            default:
                return netblock.scheme === scheme;
        }
    }
}
function parseOriginMatcherWithNetblockSupport(specList, options = new OriginParseOptions()) {
    return parseOriginMatcherWithNetblockSupportWithIntranetSites(specList, undefined, options);
}
function parseOriginMatcherWithNetblockSupportWithIntranetSites(specList, intranetSites, options = new OriginParseOptions()) {
    if (specList.length > 0) {
        log_log(`making matcher with netblock support from ${specList.length} entries`);
    }
    const matcher = new OriginMatcherWithNetblockSupport();
    const addToMatcher = (specs, addSites = true, addNetblocks = true) => {
        for (const spec of specs) {
            if (spec.startsWith(exclusionPrefix)) {
                const excludeSpec = spec.substring(exclusionPrefix.length);
                const origin = origin_parseOrigin(excludeSpec, options);
                const netblock = parseNetblock(excludeSpec, origin);
                if (maybe_some(netblock)) {
                    if (addNetblocks) {
                        matcher.excludeNetblock(netblock);
                    }
                }
                else if (maybe_some(origin)) {
                    if (addSites) {
                        matcher.excludeOrigin(origin);
                    }
                }
            }
            else {
                const origin = origin_parseOrigin(spec, options);
                const netblock = parseNetblock(spec, origin);
                if (maybe_some(netblock)) {
                    if (addNetblocks) {
                        matcher.addNetblock(netblock);
                    }
                }
                else if (maybe_some(origin)) {
                    if (addSites) {
                        matcher.addOrigin(origin);
                    }
                }
            }
        }
    };
    addToMatcher(specList);
    if (maybe_some(intranetSites)) {
        log_log(`adding ${intranetSites.specs.length} intranet entries to matcher`);
        addToMatcher(intranetSites.specs, intranetSites.trustSites, intranetSites.trustNetblocks);
    }
    if (specList.length > 0) {
        log_log('finished making matcher with netblock support');
    }
    return matcher;
}

;// CONCATENATED MODULE: ../lib/common/origin.ts









const exclusionPrefix = "^";
const wildcardSpecRegex = new RegExp("^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?");
const enclosedIPv6HostAndPortRegex = new RegExp(/^(\[[A-Za-z0-9:.]+\])(?::([0-9]+))?$/);
var WildcardSpecGroup;
(function (WildcardSpecGroup) {
    WildcardSpecGroup[WildcardSpecGroup["Scheme"] = 1] = "Scheme";
    WildcardSpecGroup[WildcardSpecGroup["HostAndPort"] = 4] = "HostAndPort";
})(WildcardSpecGroup || (WildcardSpecGroup = {}));
class OriginParseOptions {
    constructor(options) {
        this.allowNonWebSafeSchemes = false;
        this.allowFileScheme = false;
        this.allowChromeScheme = false;
        this.allowEdgeScheme = false;
        this.allowAboutScheme = false;
        this.allowChromeExtensionScheme = false;
        this.allowFirefoxExtensionScheme = false;
        this.allowWildcards = false;
        this.allowMissingWildcardScheme = false;
        this.allowTrailingWildcards = false;
        Object.assign(this, options);
    }
}
class OriginHashOptions {
    constructor(options) {
        this.seed = 0;
        this.ignoreHttpHttpsDifference = false;
        this.ignorePort = false;
        Object.assign(this, options);
    }
}
const matcherOptions = {
    separator: ".",
    wildcard_one: Scheme.WILDCARD_ONE[0],
    wildcard_some: Scheme.WILDCARD_SOME[0],
    cache_adds: false
};
const trailingWildcards = [
    matcherOptions.separator + matcherOptions.wildcard_one,
    matcherOptions.separator + matcherOptions.wildcard_some
];
function isWebSafeScheme(scheme) {
    switch (scheme) {
        case Scheme.HTTP:
            return true;
        case Scheme.HTTPS:
            return true;
        default:
            return false;
    }
}
const standardPorts = new Map([
    [Scheme.HTTP, 80], [Scheme.HTTPS, 443]
]);
class Origin {
    constructor(scheme, host, port) {
        this.scheme = scheme;
        this.host = host.toLowerCase();
        this.port = port;
    }
    toString() {
        if (this.port === undefined) {
            return `${this.scheme}//${this.host}`;
        }
        else {
            return `${this.scheme}//${this.host}:${this.port}`;
        }
    }
    toDisplayString() {
        return this.host;
    }
    absoluteOrigin() {
        const ipAddress = parseIpAddress(this.host);
        if (ipAddress || this.host.endsWith(".")) {
            return this;
        }
        return new Origin(this.scheme, this.host + ".", this.port);
    }
}
function origin_isSameOrigin(a, b, options = new OriginHashOptions()) {
    if (maybe_none(a) || maybe_none(b)) {
        return false;
    }
    let schemeA = a.scheme;
    let schemeB = b.scheme;
    if (options.ignoreHttpHttpsDifference) {
        if (schemeA === Scheme.HTTP) {
            schemeA = Scheme.HTTPS;
        }
        if (schemeB === Scheme.HTTP) {
            schemeB = Scheme.HTTPS;
        }
    }
    if (schemeA !== schemeB) {
        return false;
    }
    if (a.host !== b.host) {
        return false;
    }
    if (options.ignorePort) {
        return true;
    }
    if (a.port === undefined && b.port !== undefined) {
        return false;
    }
    if (a.port !== undefined && b.port === undefined) {
        return false;
    }
    if (a.port === undefined && b.port === undefined) {
        return true;
    }
    return a.port === b.port;
}
function hashOrigin(origin, options = new OriginHashOptions()) {
    let hash = options.seed;
    let scheme = origin.scheme;
    if (options.ignoreHttpHttpsDifference && (scheme === Scheme.HTTP)) {
        scheme = Scheme.HTTPS;
    }
    hash = murmur_hash_murmurHash(scheme, hash);
    hash = murmur_hash_murmurHash(origin.host, hash);
    if (!options.ignorePort && (origin.port !== undefined)) {
        hash = murmur_hash_murmurHash(origin.port, hash);
    }
    return hash;
}
function parseScheme(protocol, options) {
    let scheme = undefined;
    switch (protocol.toLowerCase()) {
        case Scheme.HTTP:
            scheme = Scheme.HTTP;
            break;
        case Scheme.HTTPS:
            scheme = Scheme.HTTPS;
            break;
        case Scheme.FILE:
            if (options.allowFileScheme) {
                scheme = Scheme.FILE;
            }
            break;
        case Scheme.CHROME:
            if (options.allowChromeScheme) {
                scheme = Scheme.CHROME;
            }
            break;
        case Scheme.EDGE:
            if (options.allowEdgeScheme) {
                scheme = Scheme.EDGE;
            }
            break;
        case Scheme.ABOUT:
            if (options.allowAboutScheme) {
                scheme = Scheme.ABOUT;
            }
            break;
        case Scheme.CHROME_EXTENSION:
            if (options.allowChromeExtensionScheme) {
                scheme = Scheme.CHROME_EXTENSION;
            }
            break;
        case Scheme.FIREFOX_EXTENSION:
            if (options.allowFirefoxExtensionScheme) {
                scheme = Scheme.FIREFOX_EXTENSION;
            }
            break;
        case Scheme.WILDCARD_ONE:
            if (options.allowWildcards) {
                scheme = Scheme.WILDCARD_ONE;
                break;
            }
            return undefined;
        case Scheme.WILDCARD_SOME:
            if (options.allowWildcards) {
                scheme = Scheme.WILDCARD_SOME;
                break;
            }
            return undefined;
        default:
            return undefined;
    }
    if (isWebSafeScheme(scheme)) {
        return scheme;
    }
    if (((scheme === Scheme.WILDCARD_ONE) ||
        (scheme === Scheme.WILDCARD_SOME)) &&
        options.allowWildcards) {
        return scheme;
    }
    else if ((scheme === Scheme.FILE) &&
        options.allowFileScheme) {
        return scheme;
    }
    else if ((scheme === Scheme.CHROME_EXTENSION) &&
        options.allowChromeExtensionScheme) {
        return scheme;
    }
    else if ((scheme === Scheme.FIREFOX_EXTENSION) &&
        options.allowFirefoxExtensionScheme) {
        return scheme;
    }
    else if ((scheme === Scheme.CHROME) &&
        options.allowChromeScheme) {
        return scheme;
    }
    else if ((scheme === Scheme.EDGE) &&
        options.allowEdgeScheme) {
        return scheme;
    }
    else if ((scheme === Scheme.ABOUT) &&
        options.allowAboutScheme) {
        return scheme;
    }
    else if (options.allowNonWebSafeSchemes) {
        return scheme;
    }
    else {
        return undefined;
    }
}
function origin_isEmpty(value) {
    return value.length === 0;
}
function origin_isInRange(value, min, max) {
    return (value >= min) && (value <= max);
}
function maybeParseIPV6AddressAndPort(maybeHostAndPort) {
    const match = enclosedIPv6HostAndPortRegex.exec(maybeHostAndPort);
    if (match === null) {
        return undefined;
    }
    const host = match[1];
    if (maybe_none(host)) {
        return undefined;
    }
    const port = match.length > 2 ? match[2] : undefined;
    if (maybe_some(port)) {
        return [host, port];
    }
    else {
        return [host];
    }
}
function parseHostAndPort(maybeHostAndPort) {
    const parts = maybeHostAndPort.split(':');
    switch (parts.length) {
        case 0:
            return undefined;
        case 1:
            return [maybeHostAndPort];
        case 2:
            return parts;
        default:
            return maybeParseIPV6AddressAndPort(maybeHostAndPort);
    }
}
function parsePort(portString, scheme) {
    const minPort = 0;
    const maxPort = (2 << 16) - 1;
    if (origin_isEmpty(portString)) {
        return standardPorts.get(scheme);
    }
    const radix = 10;
    const port = parseInt(portString, radix);
    if (!origin_isInRange(port, minPort, maxPort)) {
        throw new Error(`Invalid port ${port}`);
    }
    return port;
}
function origin_parseOrigin(urlOrSpec, options = new OriginParseOptions()) {
    if (isURL(urlOrSpec)) {
        return parseOriginFromURL(urlOrSpec, options);
    }
    else {
        return parseOriginFromSpec(urlOrSpec, options);
    }
}
function parseOriginFromURL(url, options) {
    const scheme = parseScheme(url.protocol, options);
    if (scheme === undefined) {
        return undefined;
    }
    try {
        const port = parsePort(url.port, scheme);
        return new Origin(scheme, url.hostname, port);
    }
    catch (e) {
        return undefined;
    }
}
function parseOriginFromSpec(spec, options) {
    if (options.allowWildcards) {
        try {
            if (!spec.includes("://") && options.allowMissingWildcardScheme) {
                if (spec.startsWith("$")) {
                    logError(`Krypton placement group notation isn't supported: ${spec}`);
                    return undefined;
                }
                spec = Scheme.WILDCARD_ONE + "//" + spec;
            }
            const match = wildcardSpecRegex.exec(spec);
            if (match === null) {
                return undefined;
            }
            const maybeScheme = match[WildcardSpecGroup.Scheme];
            if (maybeScheme === undefined) {
                return undefined;
            }
            const scheme = parseScheme(maybeScheme, options);
            if (scheme === undefined) {
                return undefined;
            }
            const maybeHostAndPort = match[WildcardSpecGroup.HostAndPort];
            if (maybeHostAndPort === undefined) {
                return undefined;
            }
            const hostAndPort = parseHostAndPort(maybeHostAndPort);
            if (maybe_none(hostAndPort)) {
                return undefined;
            }
            const host = hostAndPort[0];
            if (origin_isEmpty(host)) {
                return undefined;
            }
            const port = parsePort(hostAndPort.length > 1 ? hostAndPort[1] : '', scheme);
            if (!options.allowTrailingWildcards) {
                if (trailingWildcards.some(trailingWildcard => host.length >= trailingWildcard.length && host.endsWith(trailingWildcard))) {
                    logError(`Rule URL hostname ends in trailing wildcard: ${spec}`);
                    return undefined;
                }
            }
            return new Origin(scheme, host, port);
        }
        catch (e) {
            logError(`Error while parsing ${spec} as an origin: ${string_utils_toString(e)}`);
            return undefined;
        }
    }
    const url = url_utils_parseUrl(spec);
    if (url === undefined) {
        return undefined;
    }
    return parseOriginFromURL(url, options);
}
function makeOriginSet(options = new OriginHashOptions()) {
    return new hash_map_HashSet((origin) => hashOrigin(origin, options), (a, b) => origin_isSameOrigin(a, b, options));
}
function parseOriginSet(specList, setOptions = new OriginHashOptions(), options = new OriginParseOptions()) {
    const specSet = makeOriginSet(setOptions);
    for (const spec of specList) {
        const origin = origin_parseOrigin(spec, options);
        if (origin !== undefined) {
            specSet.add(origin);
        }
    }
    return specSet;
}
function topicForOrigin(origin) {
    let scheme = origin.scheme;
    if (scheme === Scheme.WILDCARD_SOME) {
        scheme = Scheme.WILDCARD_ONE;
    }
    return scheme.slice(0, -1) + matcherOptions.separator + origin.host;
}
class OriginMatcher {
    constructor() {
        this.matcher = new qlobber.QlobberTrue(matcherOptions);
        this.exclude_matcher = new qlobber.QlobberTrue(matcherOptions);
    }
    add(origin) {
        const topic = topicForOrigin(origin);
        this.matcher.add(topic);
        this.addAbsolute(origin, this.matcher);
        return this;
    }
    exclude(origin) {
        const topic = topicForOrigin(origin);
        this.exclude_matcher.add(topic);
        this.addAbsolute(origin, this.exclude_matcher);
        return this;
    }
    addAbsolute(origin, matcher) {
        const absolute = origin.absoluteOrigin();
        if (!origin_isSameOrigin(origin, absolute)) {
            const topic = topicForOrigin(absolute);
            matcher.add(topic);
        }
    }
    isAdded(origin) {
        const topic = topicForOrigin(origin);
        return this.matcher.test(topic);
    }
    isExcluded(origin) {
        const topic = topicForOrigin(origin);
        return this.exclude_matcher.test(topic);
    }
    has(origin) {
        const topic = topicForOrigin(origin);
        return this.matcher.test(topic) && !this.exclude_matcher.test(topic);
    }
}
function parseOriginMatcher(specList, options = new OriginParseOptions()) {
    if (specList.length > 0) {
        log(`making matcher from ${specList.length} entries`);
    }
    const matcher = new OriginMatcher();
    for (const spec of specList) {
        if (spec.startsWith(exclusionPrefix)) {
            const origin = origin_parseOrigin(spec.substring(exclusionPrefix.length), options);
            if (origin !== undefined) {
                matcher.exclude(origin);
            }
        }
        else {
            const origin = origin_parseOrigin(spec, options);
            if (origin !== undefined) {
                matcher.add(origin);
            }
        }
    }
    if (specList.length > 0) {
        log('finished making matcher');
    }
    return matcher;
}
class OriginExpiryMatcher {
    constructor() {
        this.matcher = new qlobber.Qlobber(matcherOptions);
    }
    add(origin, expiry) {
        const topic = topicForOrigin(origin);
        this.matcher.add(topic, expiry);
        return this;
    }
    has(origin) {
        const topic = topicForOrigin(origin);
        const expiries = this.matcher.match(topic);
        const now = Date.now() / 1000;
        for (const expiry of expiries) {
            if (expiry > now) {
                return true;
            }
        }
        return false;
    }
}
function parseOriginExpiryMatcher(specList, options = new OriginParseOptions()) {
    if (specList.length > 0) {
        log_log(`making expiry matcher from ${specList.length} entries`);
    }
    const matcher = new OriginExpiryMatcher();
    const now = Date.now() / 1000;
    for (const [spec, expiry] of specList) {
        if (expiry > now) {
            const origin = origin_parseOrigin(spec, options);
            if (origin !== undefined) {
                matcher.add(origin, expiry);
            }
        }
    }
    if (specList.length > 0) {
        log_log('finished making expiry matcher');
    }
    return matcher;
}
class OriginGrouper {
    constructor() {
        this.grouper = new qlobber.Qlobber(matcherOptions);
    }
    addFromSpecList(specList, group, options = new OriginParseOptions()) {
        for (const spec of specList) {
            this.addFromSpec(spec, group, options);
        }
        return this;
    }
    addFromSpec(spec, group, options = new OriginParseOptions()) {
        const origin = origin_parseOrigin(spec, options);
        if (maybe_some(origin)) {
            this.add(origin, group);
        }
        return this;
    }
    add(origin, group) {
        const topic = topicForOrigin(origin);
        this.grouper.add(topic, group);
        return this;
    }
    match(origin) {
        const topic = topicForOrigin(origin);
        return this.grouper.match(topic);
    }
}

;// CONCATENATED MODULE: ../lib/common/content-type.ts

const unknownContentType = undefined;
var ContentType;
(function (ContentType) {
    ContentType[ContentType["pdf"] = 1] = "pdf";
})(ContentType || (ContentType = {}));
var ContentTypeKey;
(function (ContentTypeKey) {
    ContentTypeKey["pdf"] = "application/pdf";
})(ContentTypeKey || (ContentTypeKey = {}));
function parseContentType(contentTypeKey) {
    const contentTypeKeyLower = contentTypeKey.toLowerCase();
    if (contentTypeKeyLower.startsWith(ContentTypeKey.pdf.toLowerCase())) {
        return ContentType.pdf;
    }
    else {
        return undefined;
    }
}
function parseRawContentType(rawContentType) {
    return maybe_some(rawContentType) ? parseContentType(rawContentType) : undefined;
}
function contentTypeToString(contentType) {
    switch (contentType) {
        case ContentType.pdf:
            return ContentTypeKey.pdf;
        default:
            return `Unknown ContentType: ${contentType}`;
    }
}

;// CONCATENATED MODULE: ../lib/common/unused.ts
function unused(arg) {
}

;// CONCATENATED MODULE: ./nav-sequence-parser.ts










var NavType;
(function (NavType) {
    NavType[NavType["noType"] = 0] = "noType";
    NavType[NavType["navigation"] = 1] = "navigation";
    NavType[NavType["redirect"] = 2] = "redirect";
    NavType[NavType["parentTab"] = 4] = "parentTab";
    NavType[NavType["contentType"] = 8] = "contentType";
    NavType[NavType["navOrRedirect"] = 3] = "navOrRedirect";
})(NavType || (NavType = {}));
var UrlCategory;
(function (UrlCategory) {
    UrlCategory[UrlCategory["uncategorizedUrl"] = 1] = "uncategorizedUrl";
    UrlCategory[UrlCategory["trustedUrl"] = 2] = "trustedUrl";
    UrlCategory[UrlCategory["untrustedUrl"] = 4] = "untrustedUrl";
    UrlCategory[UrlCategory["phishingSourceSiteUrl"] = 8] = "phishingSourceSiteUrl";
    UrlCategory[UrlCategory["webMailSiteUrl"] = 16] = "webMailSiteUrl";
    UrlCategory[UrlCategory["authSiteUrl"] = 32] = "authSiteUrl";
    UrlCategory[UrlCategory["siteRequiresAuthUrl"] = 64] = "siteRequiresAuthUrl";
    UrlCategory[UrlCategory["externalAppLink"] = 128] = "externalAppLink";
    UrlCategory[UrlCategory["anyUrl"] = 251] = "anyUrl";
})(UrlCategory || (UrlCategory = {}));
function* orUrlCategories(mask) {
    const categories = [
        UrlCategory.uncategorizedUrl,
        UrlCategory.trustedUrl,
        UrlCategory.untrustedUrl,
        UrlCategory.phishingSourceSiteUrl,
        UrlCategory.webMailSiteUrl
    ];
    for (const category of categories) {
        if ((mask & category) !== 0x0) {
            yield category;
        }
    }
}
var NavModifer;
(function (NavModifer) {
    NavModifer[NavModifer["noModifier"] = 0] = "noModifier";
    NavModifer[NavModifer["repeated"] = 1] = "repeated";
    NavModifer[NavModifer["not"] = 2] = "not";
    NavModifer[NavModifer["or"] = 4] = "or";
})(NavModifer || (NavModifer = {}));
function categorizeUrl(isTrustedUrl, isUntrustedUrl, isPhishingSourceSite, isWebMailSite, isExternalAppLink) {
    if (isExternalAppLink) {
        return UrlCategory.externalAppLink;
    }
    let category = 0x0;
    if (isPhishingSourceSite) {
        category |= UrlCategory.phishingSourceSiteUrl;
    }
    if (isWebMailSite) {
        category |= UrlCategory.webMailSiteUrl;
    }
    if (isTrustedUrl || isUntrustedUrl) {
        if (isUntrustedUrl) {
            category |= UrlCategory.untrustedUrl;
        }
        else {
            category |= UrlCategory.trustedUrl;
        }
    }
    return category !== 0x0 ? category : UrlCategory.uncategorizedUrl;
}
class NavPattern {
    constructor(modifiers, type, id) {
        this.modifiers = modifiers;
        this.type = type;
        this.id = id;
    }
    hasModifier(modifier) {
        return (this.modifiers & modifier) !== NavModifer.noModifier;
    }
    get hasRepeatedModifier() {
        return this.hasModifier(NavModifer.repeated);
    }
    get hasNotModifer() {
        return this.hasModifier(NavModifer.not);
    }
    get hasOrModifier() {
        return this.hasModifier(NavModifer.or);
    }
    *buildNavigations() {
        return;
    }
    get asBackReference() {
        return undefined;
    }
    get asContentType() {
        return undefined;
    }
    *navTypes() {
        const navTypes = [
            NavType.navigation,
            NavType.redirect,
            NavType.parentTab
        ];
        const mask = this.type;
        for (const navType of navTypes) {
            if ((mask & navType) !== 0x0) {
                yield navType;
            }
        }
    }
}
class OriginNavPattern extends NavPattern {
    constructor(modifiers, type, origin, id) {
        super(modifiers, type, id);
        this.origin = origin;
    }
    *buildNavigations() {
        for (const navType of this.navTypes()) {
            yield new OriginNav(navType, this.origin);
        }
    }
}
class CategorizedNavPattern extends NavPattern {
    constructor(modifiers, type, category, id) {
        super(modifiers, type, id);
        this.category = category;
    }
    *buildNavigations() {
        for (const navType of this.navTypes()) {
            if (this.hasNotModifer) {
                yield new CategorizedNotNav(navType, this.category);
            }
            else if (this.category === UrlCategory.anyUrl) {
                yield new CategorizedNotNav(navType, UrlCategory.untrustedUrl);
            }
            else if (this.hasOrModifier) {
                for (const category of orUrlCategories(this.category)) {
                    yield new CategorizedNav(navType, category);
                }
            }
            else {
                yield new CategorizedNav(navType, this.category);
            }
        }
    }
}
class GroupNavPattern extends NavPattern {
    constructor(modifiers, type, groupName, id) {
        super(modifiers, type, id);
        this.groupName = groupName;
    }
    *buildNavigations() {
        for (const navType of this.navTypes()) {
            yield new GroupNav(navType, this.groupName);
        }
    }
}
class BackRefNavPattern extends NavPattern {
    constructor(modifiers, type, backRef, id) {
        super(modifiers, type, id);
        this.modifiers = modifiers;
        this.type = type;
        this.backRef = backRef;
    }
    get asBackReference() {
        return this;
    }
}
class ContentTypeNavPattern extends NavPattern {
    constructor(contentType, id) {
        super(NavModifer.noModifier, NavType.noType, id);
        this.contentType = contentType;
    }
    get asContentType() {
        return this;
    }
}
class OriginNav {
    constructor(type, origin) {
        this.type = type;
        this.origin = origin;
    }
    hashWithSeed(seed) {
        let hash = seed;
        hash = murmur_hash_murmurHash(this.type, hash);
        hash = hashOrigin(this.origin, new OriginHashOptions({ seed: hash }));
        return hash;
    }
    hash() {
        const seed = 0;
        return this.hashWithSeed(seed);
    }
    compare(other) {
        return (this.type === other.type) && origin_isSameOrigin(this.origin, other.origin);
    }
}
class CategorizedNav {
    constructor(type, category) {
        this.type = type;
        this.category = category;
    }
    hashWithSeed(seed) {
        let hash = seed;
        hash = murmur_hash_murmurHash(this.type, hash);
        hash = murmur_hash_murmurHash(this.category, hash);
        return hash;
    }
    hash() {
        const seed = 0;
        return this.hashWithSeed(seed);
    }
    compare(other) {
        return (this.type === other.type) && (this.category === other.category);
    }
}
class CategorizedNotNav {
    constructor(type, notCategory) {
        this.type = type;
        this.notCategory = notCategory;
    }
    hashWithSeed(seed) {
        let hash = seed;
        hash = murmur_hash_murmurHash(this.type, hash);
        hash = murmur_hash_murmurHash(this.notCategory, hash);
        return hash;
    }
    hash() {
        const seed = 0;
        return this.hashWithSeed(seed);
    }
    compare(other) {
        return (this.type === other.type) && (this.notCategory === other.notCategory);
    }
}
class GroupNav {
    constructor(type, groupName) {
        this.type = type;
        this.groupName = groupName;
    }
    hashWithSeed(seed) {
        let hash = seed;
        hash = murmur_hash_murmurHash(this.type, hash);
        hash = murmur_hash_murmurHash(this.groupName, hash);
        return hash;
    }
    hash() {
        const seed = 0;
        return this.hashWithSeed(seed);
    }
    compare(other) {
        return (this.type === other.type) &&
            compareStrings(this.groupName, other.groupName);
    }
}
function makeOriginNav(type, url) {
    if (none(url)) {
        return undefined;
    }
    const origin = parseOrigin(url);
    if (none(origin)) {
        return undefined;
    }
    return new OriginNav(type, origin);
}
function isOriginNav(navigation) {
    return navigation instanceof OriginNav;
}
function isCategorizedNav(navigation) {
    return navigation instanceof CategorizedNav;
}
function isCategorizedNotNav(navigation) {
    return navigation instanceof CategorizedNotNav;
}
function isGroupNav(navigation) {
    return navigation instanceof GroupNav;
}
function hashNavigation(navigation) {
    return navigation.hash();
}
function isSameNavigation(a, b) {
    if (isOriginNav(a)) {
        return isOriginNav(b) ? a.compare(b) : false;
    }
    if (isCategorizedNav(a)) {
        return isCategorizedNav(b) ? a.compare(b) : false;
    }
    if (isCategorizedNotNav(a)) {
        return isCategorizedNotNav(b) ? a.compare(b) : false;
    }
    if (isGroupNav(a)) {
        return isGroupNav(b) ? a.compare(b) : false;
    }
    return false;
}
var NavTypeKey;
(function (NavTypeKey) {
    NavTypeKey["navigation"] = "navigateTo";
    NavTypeKey["redirect"] = "redirectTo";
    NavTypeKey["parentTab"] = "parentTab";
    NavTypeKey["contentType"] = "contentType";
    NavTypeKey["navOrRedirect"] = "navOrRedirectTo";
})(NavTypeKey || (NavTypeKey = {}));
var UrlCategoryKey;
(function (UrlCategoryKey) {
    UrlCategoryKey["anyUrl"] = "<anyUrl>";
    UrlCategoryKey["uncategorizedUrl"] = "<uncategorizedUrl>";
    UrlCategoryKey["trustedUrl"] = "<trustedUrl>";
    UrlCategoryKey["untrustedUrl"] = "<untrustedUrl>";
    UrlCategoryKey["phishingSourceSiteUrl"] = "<phishingSourceSiteUrl>";
    UrlCategoryKey["webMailSiteUrl"] = "<webMailSiteUrl>";
    UrlCategoryKey["authSiteUrl"] = "<authSiteUrl>";
    UrlCategoryKey["siteRequiresAuthUrl"] = "<siteRequiresAuthUrl>";
    UrlCategoryKey["externalAppLink"] = "<externalAppLink>";
})(UrlCategoryKey || (UrlCategoryKey = {}));
var NavModiferKey;
(function (NavModiferKey) {
    NavModiferKey["repeated"] = "repeat";
    NavModiferKey["not"] = "not";
    NavModiferKey["or"] = "or";
})(NavModiferKey || (NavModiferKey = {}));
const urlCategoryValues = Object.keys(UrlCategory).map(Number).filter(value => !isNaN(value) && value !== UrlCategory.anyUrl);
function urlCategoryToString(urlCategory) {
    if (urlCategory === UrlCategory.anyUrl) {
        return `<${UrlCategory[UrlCategory.anyUrl]}>`;
    }
    let categoryStrings = [];
    for (const category of urlCategoryValues) {
        if ((urlCategory & category) !== 0) {
            categoryStrings.push(UrlCategory[category]);
        }
    }
    if (categoryStrings.length > 0) {
        return `<${categoryStrings.join("|")}>`;
    }
    else {
        return `<Invalid UrlCategory: ${urlCategory}>`;
    }
}
function parseNavType(navTypeKey) {
    switch (navTypeKey) {
        case NavTypeKey.navigation:
            return NavType.navigation;
        case NavTypeKey.redirect:
            return NavType.redirect;
        case NavTypeKey.parentTab:
            return NavType.parentTab;
        case NavTypeKey.contentType:
            return NavType.contentType;
        case NavTypeKey.navOrRedirect:
            return NavType.navOrRedirect;
        default:
            return undefined;
    }
}
function parseUrlCategory(urlCategoryKey) {
    switch (urlCategoryKey) {
        case UrlCategoryKey.anyUrl:
            return UrlCategory.anyUrl;
        case UrlCategoryKey.uncategorizedUrl:
            return UrlCategory.uncategorizedUrl;
        case UrlCategoryKey.trustedUrl:
            return UrlCategory.trustedUrl;
        case UrlCategoryKey.untrustedUrl:
            return UrlCategory.untrustedUrl;
        case UrlCategoryKey.phishingSourceSiteUrl:
            return UrlCategory.phishingSourceSiteUrl;
        case UrlCategoryKey.webMailSiteUrl:
            return UrlCategory.webMailSiteUrl;
        case UrlCategoryKey.authSiteUrl:
            return UrlCategory.authSiteUrl;
        case UrlCategoryKey.siteRequiresAuthUrl:
            return UrlCategory.siteRequiresAuthUrl;
        case UrlCategoryKey.externalAppLink:
            return UrlCategory.externalAppLink;
        default:
            return undefined;
    }
}
function parseNavModiferKey(navModifierKey) {
    switch (navModifierKey) {
        case NavModiferKey.repeated:
            return NavModifer.repeated;
        case NavModiferKey.not:
            return NavModifer.not;
        case NavModiferKey.or:
            return NavModifer.or;
        default:
            return undefined;
    }
}
var HttpHeaderType;
(function (HttpHeaderType) {
    HttpHeaderType[HttpHeaderType["contentType"] = 1] = "contentType";
})(HttpHeaderType || (HttpHeaderType = {}));
var HttpHeaderTypeKey;
(function (HttpHeaderTypeKey) {
    HttpHeaderTypeKey["contentType"] = "Content-Type";
})(HttpHeaderTypeKey || (HttpHeaderTypeKey = {}));
function parseHeaderType(headerKey) {
    switch (headerKey.toLowerCase()) {
        case HttpHeaderTypeKey.contentType.toLowerCase():
            return HttpHeaderType.contentType;
        default:
            return undefined;
    }
}
function headerTypeToString(header) {
    switch (header) {
        case HttpHeaderType.contentType:
            return HttpHeaderTypeKey.contentType;
        default:
            return `Unknown Header: ${header}`;
    }
}
function parseGroupName(groupName) {
    const groupNamePrefix = "$";
    if (groupName.startsWith(groupNamePrefix)) {
        return groupName;
    }
    else {
        return undefined;
    }
}
var LexedNavTokenType;
(function (LexedNavTokenType) {
    LexedNavTokenType[LexedNavTokenType["navModifier"] = 0] = "navModifier";
    LexedNavTokenType[LexedNavTokenType["navType"] = 1] = "navType";
    LexedNavTokenType[LexedNavTokenType["urlCategory"] = 2] = "urlCategory";
    LexedNavTokenType[LexedNavTokenType["origin"] = 3] = "origin";
    LexedNavTokenType[LexedNavTokenType["backRef"] = 4] = "backRef";
    LexedNavTokenType[LexedNavTokenType["urlCategoryArray"] = 5] = "urlCategoryArray";
    LexedNavTokenType[LexedNavTokenType["headerType"] = 6] = "headerType";
    LexedNavTokenType[LexedNavTokenType["contentType"] = 7] = "contentType";
    LexedNavTokenType[LexedNavTokenType["groupName"] = 8] = "groupName";
})(LexedNavTokenType || (LexedNavTokenType = {}));
function lexStringToken(token) {
    const modifier = parseNavModiferKey(token);
    if (maybe_some(modifier)) {
        return [LexedNavTokenType.navModifier, modifier];
    }
    const type = parseNavType(token);
    if (maybe_some(type)) {
        return [LexedNavTokenType.navType, type];
    }
    const category = parseUrlCategory(token);
    if (maybe_some(category)) {
        return [LexedNavTokenType.urlCategory, category];
    }
    const origin = origin_parseOrigin(token);
    if (maybe_some(origin)) {
        return [LexedNavTokenType.origin, origin];
    }
    const header = parseHeaderType(token);
    if (maybe_some(header)) {
        return [LexedNavTokenType.headerType, header];
    }
    const contentType = parseContentType(token);
    if (maybe_some(contentType)) {
        return [LexedNavTokenType.contentType, contentType];
    }
    const groupName = parseGroupName(token);
    if (maybe_some(groupName)) {
        return [LexedNavTokenType.groupName, groupName];
    }
    return undefined;
}
function lexNavigation(tokens, lexedTokens) {
    if (isEmpty(tokens)) {
        return true;
    }
    const [token, remainingTokens] = [first(tokens), rest(tokens)];
    const oldLength = lexedTokens.length;
    if (isString(token)) {
        const lexedToken = lexStringToken(token);
        if (maybe_some(lexedToken)) {
            lexedTokens.push(lexedToken);
        }
    }
    if (isNumber(token)) {
        const backRef = token;
        lexedTokens.push([LexedNavTokenType.backRef, backRef]);
    }
    if (isArray(token)) {
        const subTokens = token;
        const urlCategories = subTokens.map((subToken) => {
            if (isString(subToken)) {
                return parseUrlCategory(subToken);
            }
            return undefined;
        }).filter(maybe_some);
        const didLexSubTokens = (urlCategories.length === subTokens.length);
        if (!didLexSubTokens) {
            return false;
        }
        lexedTokens.push([LexedNavTokenType.urlCategoryArray, urlCategories]);
    }
    const newLength = lexedTokens.length;
    const didLexToken = (newLength > oldLength);
    if (didLexToken) {
        return lexNavigation(remainingTokens, lexedTokens);
    }
    else {
        return false;
    }
}
var NavNodeType;
(function (NavNodeType) {
    NavNodeType[NavNodeType["repeatedNav"] = 0] = "repeatedNav";
    NavNodeType[NavNodeType["typedNav"] = 1] = "typedNav";
    NavNodeType[NavNodeType["originNav"] = 2] = "originNav";
    NavNodeType[NavNodeType["categorizedNav"] = 3] = "categorizedNav";
    NavNodeType[NavNodeType["backRef"] = 4] = "backRef";
    NavNodeType[NavNodeType["notNav"] = 5] = "notNav";
    NavNodeType[NavNodeType["orNav"] = 6] = "orNav";
    NavNodeType[NavNodeType["contentTypeNav"] = 7] = "contentTypeNav";
    NavNodeType[NavNodeType["groupNameNav"] = 8] = "groupNameNav";
})(NavNodeType || (NavNodeType = {}));
class NavNode {
    constructor(type) {
        this.type = type;
    }
    visit(visitor) {
        unused(visitor);
    }
}
class RepeatedNavNode extends NavNode {
    constructor(child) {
        super(NavNodeType.repeatedNav);
        this.child = child;
    }
    visit(visitor) {
        visitor.visitRepeatedNav(this);
        this.child.visit(visitor);
    }
}
class TypedNavNode extends NavNode {
    constructor(navType, child) {
        super(NavNodeType.typedNav);
        this.navType = navType;
        this.child = child;
    }
    visit(visitor) {
        visitor.visitTypedNav(this);
        this.child.visit(visitor);
    }
}
class OriginNavNode extends NavNode {
    constructor(origin) {
        super(NavNodeType.originNav);
        this.origin = origin;
    }
    visit(visitor) {
        visitor.visitOriginNav(this);
    }
}
class CategorizedNavNode extends NavNode {
    constructor(category) {
        super(NavNodeType.categorizedNav);
        this.category = category;
    }
    visit(visitor) {
        visitor.visitCategorizedNav(this);
    }
}
class NotNavNode extends NavNode {
    constructor(child) {
        super(NavNodeType.notNav);
        this.child = child;
    }
    visit(visitor) {
        visitor.visitNotNav(this);
        this.child.visit(visitor);
    }
}
class OrNavNode extends NavNode {
    constructor(categories) {
        super(NavNodeType.orNav);
        this.categories = categories;
    }
    visit(visitor) {
        visitor.visitOrNav(this);
    }
}
class BackRefNavNode extends NavNode {
    constructor(backRef) {
        super(NavNodeType.backRef);
        this.backRef = backRef;
    }
    visit(visitor) {
        visitor.visitBackRefNav(this);
    }
}
class ContentTypeNavNode extends NavNode {
    constructor(contentType) {
        super(NavNodeType.contentTypeNav);
        this.contentType = contentType;
    }
    visit(visitor) {
        visitor.visitContentTypeNav(this);
    }
}
class GroupNameNavNode extends NavNode {
    constructor(groupName) {
        super(NavNodeType.groupNameNav);
        this.groupName = groupName;
    }
    visit(visitor) {
        visitor.visitGroupNameNav(this);
    }
}
function parseNavNode(tokens) {
    if (isEmpty(tokens)) {
        return undefined;
    }
    const [[tokenType, token], remainingTokens] = [first(tokens), rest(tokens)];
    switch (tokenType) {
        case LexedNavTokenType.navModifier: {
            const modifier = token;
            switch (modifier) {
                case NavModifer.repeated: {
                    const childNode = parseNavNode(remainingTokens);
                    if (maybe_none(childNode)) {
                        return undefined;
                    }
                    return new RepeatedNavNode(childNode);
                }
                case NavModifer.not: {
                    if (isEmpty(remainingTokens)) {
                        return undefined;
                    }
                    const childNode = parseNavNode(remainingTokens);
                    if (maybe_none(childNode)) {
                        return undefined;
                    }
                    return new NotNavNode(childNode);
                }
                case NavModifer.or: {
                    if (isEmpty(remainingTokens)) {
                        return undefined;
                    }
                    const [nextTokenType, nextToken] = first(remainingTokens);
                    if (nextTokenType !== LexedNavTokenType.urlCategoryArray) {
                        return undefined;
                    }
                    if (!isArray(nextToken)) {
                        return undefined;
                    }
                    const categories = nextToken;
                    if (!isEmpty(rest(remainingTokens))) {
                        return undefined;
                    }
                    return new OrNavNode(categories);
                }
                default: {
                    return undefined;
                }
            }
        }
        case LexedNavTokenType.navType: {
            const navType = token;
            const childNode = parseNavNode(remainingTokens);
            if (maybe_none(childNode)) {
                return undefined;
            }
            return new TypedNavNode(navType, childNode);
        }
        case LexedNavTokenType.urlCategory: {
            const category = token;
            if (!isEmpty(remainingTokens)) {
                return undefined;
            }
            return new CategorizedNavNode(category);
        }
        case LexedNavTokenType.origin: {
            const origin = token;
            if (!isEmpty(remainingTokens)) {
                return undefined;
            }
            return new OriginNavNode(origin);
        }
        case LexedNavTokenType.backRef: {
            const backRef = token;
            if (!isEmpty(remainingTokens)) {
                return undefined;
            }
            return new BackRefNavNode(backRef);
        }
        case LexedNavTokenType.headerType: {
            if (isEmpty(remainingTokens)) {
                return undefined;
            }
            const [nextTokenType, nextToken] = first(remainingTokens);
            if (nextTokenType !== LexedNavTokenType.contentType) {
                return undefined;
            }
            if (!isEmpty(rest(remainingTokens))) {
                return undefined;
            }
            const contentType = nextToken;
            return new ContentTypeNavNode(contentType);
        }
        case LexedNavTokenType.groupName: {
            const groupName = token;
            if (!isEmpty(remainingTokens)) {
                return undefined;
            }
            return new GroupNameNavNode(groupName);
        }
        default: {
            return undefined;
        }
    }
}
var NavNodeVisitorState;
(function (NavNodeVisitorState) {
    NavNodeVisitorState[NavNodeVisitorState["visitedNoNode"] = 0] = "visitedNoNode";
    NavNodeVisitorState[NavNodeVisitorState["visitedRepeatedNode"] = 1] = "visitedRepeatedNode";
    NavNodeVisitorState[NavNodeVisitorState["visitiedTypedNode"] = 2] = "visitiedTypedNode";
    NavNodeVisitorState[NavNodeVisitorState["visitedNotNode"] = 3] = "visitedNotNode";
    NavNodeVisitorState[NavNodeVisitorState["visitedTerminalNode"] = 4] = "visitedTerminalNode";
    NavNodeVisitorState[NavNodeVisitorState["error"] = 5] = "error";
})(NavNodeVisitorState || (NavNodeVisitorState = {}));
class NavNodeVisitor {
    constructor(id) {
        this.id = id;
        this.state = NavNodeVisitorState.visitedNoNode;
        this.modifiers = NavModifer.noModifier;
        this.navType = undefined;
        this.navPattern = undefined;
    }
    visitRepeatedNav(node) {
        switch (this.state) {
            case NavNodeVisitorState.visitedNoNode: {
                this.state = NavNodeVisitorState.visitedRepeatedNode;
                this.modifiers |= NavModifer.repeated;
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitTypedNav(node) {
        const onVisited = () => {
            this.state = NavNodeVisitorState.visitiedTypedNode;
            this.navType = node.navType;
        };
        switch (this.state) {
            case NavNodeVisitorState.visitedNoNode: {
                onVisited();
                break;
            }
            case NavNodeVisitorState.visitedRepeatedNode: {
                onVisited();
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitOriginNav(node) {
        switch (this.state) {
            case NavNodeVisitorState.visitiedTypedNode: {
                this.state = NavNodeVisitorState.visitedTerminalNode;
                this.navPattern = new OriginNavPattern(this.modifiers, this.navType, node.origin, this.id);
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitCategorizedNav(node) {
        const onVisited = () => {
            this.state = NavNodeVisitorState.visitedTerminalNode;
            this.navPattern = new CategorizedNavPattern(this.modifiers, this.navType, node.category, this.id);
        };
        switch (this.state) {
            case NavNodeVisitorState.visitiedTypedNode: {
                onVisited();
                break;
            }
            case NavNodeVisitorState.visitedNotNode: {
                onVisited();
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitBackRefNav(node) {
        const onVisited = () => {
            this.state = NavNodeVisitorState.visitedTerminalNode;
            this.navPattern = new BackRefNavPattern(this.modifiers, this.navType, node.backRef, this.id);
        };
        switch (this.state) {
            case NavNodeVisitorState.visitiedTypedNode: {
                onVisited();
                break;
            }
            case NavNodeVisitorState.visitedNotNode: {
                onVisited();
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitNotNav(node) {
        switch (this.state) {
            case NavNodeVisitorState.visitiedTypedNode: {
                this.state = NavNodeVisitorState.visitedNotNode;
                this.modifiers |= NavModifer.not;
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitOrNav(node) {
        switch (this.state) {
            case NavNodeVisitorState.visitiedTypedNode: {
                this.state = NavNodeVisitorState.visitedTerminalNode;
                this.modifiers |= NavModifer.or;
                let categories = 0x0;
                for (const category of node.categories) {
                    categories |= category;
                }
                this.navPattern = new CategorizedNavPattern(this.modifiers, this.navType, categories, this.id);
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitContentTypeNav(node) {
        switch (this.state) {
            case NavNodeVisitorState.visitedNoNode: {
                this.state = NavNodeVisitorState.visitedTerminalNode;
                this.navPattern = new ContentTypeNavPattern(node.contentType, this.id);
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visitGroupNameNav(node) {
        switch (this.state) {
            case NavNodeVisitorState.visitiedTypedNode: {
                this.state = NavNodeVisitorState.visitedTerminalNode;
                this.navPattern = new GroupNavPattern(this.modifiers, this.navType, node.groupName, this.id);
                break;
            }
            default: {
                this.state = NavNodeVisitorState.error;
                break;
            }
        }
    }
    visit(node) {
        node.visit(this);
        if (this.state === NavNodeVisitorState.error) {
            return undefined;
        }
        if (this.state !== NavNodeVisitorState.visitedTerminalNode) {
            return undefined;
        }
        return this.navPattern;
    }
}
function parseNavigation(tokens, index) {
    if (isEmpty(tokens)) {
        return undefined;
    }
    const lexedTokens = [];
    if (!lexNavigation(tokens, lexedTokens)) {
        return undefined;
    }
    const node = parseNavNode(lexedTokens);
    if (maybe_none(node)) {
        return undefined;
    }
    const id = index + 1;
    const visitor = new NavNodeVisitor(id);
    const navigation = visitor.visit(node);
    return navigation;
}
function parseNavSequence(serializedNavSequence) {
    const parsedNavSequence = serializedNavSequence.map(parseNavigation);
    if (parsedNavSequence.some(maybe_none)) {
        return undefined;
    }
    const navSequence = parsedNavSequence.filter(maybe_some);
    if (!isEmpty(navSequence) && navSequence[navSequence.length - 1].hasRepeatedModifier) {
        logError("The 'repeat' modifier cannot be used in the last nav pattern of a sequence");
        return undefined;
    }
    return navSequence;
}
function parseNavMetadata(serializedNavMetadata) {
    if (maybe_none(serializedNavMetadata.precedence)) {
        return undefined;
    }
    if (maybe_none(serializedNavMetadata.allow) && maybe_none(serializedNavMetadata.block)) {
        return undefined;
    }
    if (serializedNavMetadata.block === true && maybe_none(serializedNavMetadata.navigateTo)) {
        return undefined;
    }
    return serializedNavMetadata;
}
function parseNavSeqData(serializedNavSeqData) {
    const parsedNavSequence = parseNavSequence(serializedNavSeqData.seq);
    if (maybe_none(parsedNavSequence)) {
        return undefined;
    }
    const parsedNavMetadata = parseNavMetadata(serializedNavSeqData.metadata);
    if (maybe_none(parsedNavMetadata)) {
        return undefined;
    }
    return [parsedNavSequence, parsedNavMetadata];
}
function isValidSerializedPhishingNavSeqData(serializedPhishingNavSeqData) {
    if (maybe_none(serializedPhishingNavSeqData.version)) {
        return false;
    }
    if (maybe_none(serializedPhishingNavSeqData.builtinRulesPrecedence)) {
        return false;
    }
    if (maybe_none(serializedPhishingNavSeqData.seqs)) {
        return false;
    }
    return true;
}
function parseSerializedPhishingNavSeqData(serializedPhishingNavSeqData, expectedVersion) {
    if (!isValidSerializedPhishingNavSeqData(serializedPhishingNavSeqData)) {
        logError(`Invalid SerializedPhishingNavSeqData: ${string_utils_toString(serializedPhishingNavSeqData)}`);
        return undefined;
    }
    if (serializedPhishingNavSeqData.version !== expectedVersion) {
        logError(new Error(`SerializedPhishingNavSeqData version check failed. ${string_utils_toString({
            version: serializedPhishingNavSeqData.version,
            expectedVersion: expectedVersion
        })}`));
        return undefined;
    }
    const builtinRulesPrecedence = serializedPhishingNavSeqData.builtinRulesPrecedence;
    const phishingNavSeqs = serializedPhishingNavSeqData.seqs.map(parseNavSeqData);
    if (!isWellDefinedArray(phishingNavSeqs)) {
        logError(`Failed to parse phishingNavigationSequences: ${string_utils_toString(serializedPhishingNavSeqData)}`);
        return undefined;
    }
    return { builtinRulesPrecedence, phishingNavSeqs };
}

;// CONCATENATED MODULE: ../lib/common/http-method.ts
var HttpMethodType;
(function (HttpMethodType) {
    HttpMethodType[HttpMethodType["get"] = 0] = "get";
    HttpMethodType[HttpMethodType["post"] = 1] = "post";
})(HttpMethodType || (HttpMethodType = {}));
;
var HttpMethodKeys;
(function (HttpMethodKeys) {
    HttpMethodKeys["get"] = "get";
    HttpMethodKeys["post"] = "post";
})(HttpMethodKeys || (HttpMethodKeys = {}));
function parseHttpMethod(method) {
    switch (method.toLowerCase()) {
        case HttpMethodKeys.get:
            return HttpMethodType.get;
        case HttpMethodKeys.post:
            return HttpMethodType.post;
        default:
            return undefined;
    }
}
function httpMethodTypeToString(methodType) {
    switch (methodType) {
        case HttpMethodType.get:
            return HttpMethodKeys.get.toUpperCase();
        case HttpMethodType.post:
            return HttpMethodKeys.post.toUpperCase();
        default:
            return `Invalid HttpMethodType: ${methodType}`;
    }
}

;// CONCATENATED MODULE: ./phishing-source-sites.ts








const allowedGoogleAppsGroupName = "$allowedGoogleApps";
const defaultAllowedGoogleApps = [
    "https://keep.google.com",
    "https://calendar.google.com",
    "https://contacts.google.com",
    "https://hangouts.google.com",
    "https://accounts.google.com",
    "https://myaccount.google.com",
];
var TabType;
(function (TabType) {
    TabType[TabType["newTab"] = 0] = "newTab";
    TabType[TabType["sameTab"] = 1] = "sameTab";
})(TabType || (TabType = {}));
class PhishingSourceSitesKey {
    constructor(tabType, navType, methodType) {
        this.tabType = tabType;
        this.navType = navType;
        this.methodType = methodType;
    }
    hashWithSeed(seed) {
        let hash = seed;
        hash = murmur_hash_murmurHash(this.tabType, hash);
        hash = murmur_hash_murmurHash(this.navType, hash);
        hash = murmur_hash_murmurHash(this.methodType, hash);
        return hash;
    }
    hash() {
        const seed = 0;
        return this.hashWithSeed(seed);
    }
    compare(other) {
        return (this.tabType === other.tabType) &&
            (this.navType === other.navType) &&
            (this.methodType === other.methodType);
    }
}
class EmptyPhishingSourceSites {
    isPhishingSourceSite(origin) {
        return false;
    }
    isWebMailSite(origin) {
        return false;
    }
    siteRequiresAuth(origin) {
        return false;
    }
    isAuthSite(origin) {
        return false;
    }
    findGroups(origin) {
        return [];
    }
    shouldBlockNavigation(tabType, navType, methodType, sourceOrigin) {
        return false;
    }
    get shouldEnableNavigationRequestTypeHeuristics() {
        return true;
    }
}
class PhishingSourceSites {
    constructor(serializedSites) {
        this.serializedSites = serializedSites;
        this.keyedSites = makeDefaultHashMap();
        this.groups = new OriginGrouper();
        this.phishingSourceSites = this.parseOriginMatcher(serializedSites.phishingSourceSites);
        this.webMailSites = this.parseOriginMatcher(serializedSites.webMail);
        this.requireAuthSites = this.parseOriginMatcher(serializedSites.advanced.requireAuth);
        this.authSites = this.parseOriginMatcher(serializedSites.advanced.auth);
        this.parseGroups(serializedSites.groups);
        this.deserializeKeyedSites(serializedSites);
    }
    get originParseOptions() {
        return new OriginParseOptions({
            allowWildcards: true,
            allowMissingWildcardScheme: true
        });
    }
    parseOriginMatcher(specList) {
        return parseOriginMatcherWithNetblockSupport(specList, this.originParseOptions);
    }
    parseGroups(serializedGroups) {
        const groups = Object.keys(serializedGroups);
        if (!groups.includes(allowedGoogleAppsGroupName)) {
            this.groups.addFromSpecList(defaultAllowedGoogleApps, allowedGoogleAppsGroupName, this.originParseOptions);
        }
        for (const group of groups) {
            const specList = serializedGroups[group];
            this.groups.addFromSpecList(specList, group, this.originParseOptions);
        }
    }
    makeKey(tabType, navType, methodType) {
        const key = new PhishingSourceSitesKey(tabType, navType, methodType);
        return key;
    }
    shouldBlockNavigation(tabType, navType, methodType, sourceOrigin) {
        const key = this.makeKey(tabType, navType, methodType);
        const matcher = this.keyedSites.get(key);
        if (maybe_none(matcher)) {
            return false;
        }
        return matcher.has(sourceOrigin);
    }
    isPhishingSourceSite(origin) {
        return this.phishingSourceSites.has(origin);
    }
    isWebMailSite(origin) {
        return this.webMailSites.has(origin);
    }
    siteRequiresAuth(origin) {
        return this.requireAuthSites.has(origin);
    }
    isAuthSite(origin) {
        return this.authSites.has(origin);
    }
    findGroups(origin) {
        return this.groups.match(origin);
    }
    get shouldEnableNavigationRequestTypeHeuristics() {
        return this.serializedSites.advanced.heuristics.navigationRequestType;
    }
    addKeyedSites(tabType, navType, methodType, specList) {
        const deduplicate = (values) => {
            const set = makeStringHashSet();
            set.addMany(values);
            return set.toArray();
        };
        const dedeuplicatedSpecList = deduplicate(specList);
        const matcher = this.parseOriginMatcher(dedeuplicatedSpecList);
        const key = this.makeKey(tabType, navType, methodType);
        this.keyedSites.put(key, matcher);
    }
    deserializeKeyedSites(serializedSites) {
        const withWebMail = (sites) => {
            return sites.concat(serializedSites.webMail);
        };
        const withPhishingSourceSites = (sites) => {
            return sites.concat(serializedSites.phishingSourceSites);
        };
        const withDisableHeuristics = (() => {
            if (this.shouldEnableNavigationRequestTypeHeuristics) {
                return (sites) => {
                    return sites;
                };
            }
            else {
                return (sites) => {
                    return withPhishingSourceSites(withWebMail(sites));
                };
            }
        })();
        this.addKeyedSites(TabType.newTab, NavType.navigation, HttpMethodType.get, withPhishingSourceSites(withWebMail(serializedSites.advanced.newTab.navigate.get)));
        this.addKeyedSites(TabType.newTab, NavType.navigation, HttpMethodType.post, withDisableHeuristics(serializedSites.advanced.newTab.navigate.post));
        this.addKeyedSites(TabType.newTab, NavType.redirect, HttpMethodType.get, withDisableHeuristics(serializedSites.advanced.newTab.redirect.get));
        this.addKeyedSites(TabType.newTab, NavType.redirect, HttpMethodType.post, withDisableHeuristics(serializedSites.advanced.newTab.redirect.post));
        this.addKeyedSites(TabType.sameTab, NavType.navigation, HttpMethodType.get, withDisableHeuristics(withPhishingSourceSites(serializedSites.advanced.sameTab.navigate.get)));
        this.addKeyedSites(TabType.sameTab, NavType.navigation, HttpMethodType.post, withDisableHeuristics(serializedSites.advanced.sameTab.navigate.post));
        this.addKeyedSites(TabType.sameTab, NavType.redirect, HttpMethodType.get, withDisableHeuristics(withPhishingSourceSites(serializedSites.advanced.sameTab.redirect.get)));
        this.addKeyedSites(TabType.sameTab, NavType.redirect, HttpMethodType.post, withDisableHeuristics(serializedSites.advanced.sameTab.redirect.post));
    }
}

;// CONCATENATED MODULE: ../lib/host/serialized-is-enabled.ts




var EnabledFlags;
(function (EnabledFlags) {
    EnabledFlags[EnabledFlags["Disabled"] = 0] = "Disabled";
    EnabledFlags[EnabledFlags["SbxEnabled"] = 1] = "SbxEnabled";
    EnabledFlags[EnabledFlags["IpEnabled"] = 2] = "IpEnabled";
    EnabledFlags[EnabledFlags["UfEnabled"] = 4] = "UfEnabled";
    EnabledFlags[EnabledFlags["AiBrandProtectionEnabled"] = 8] = "AiBrandProtectionEnabled";
})(EnabledFlags || (EnabledFlags = {}));
function convertLegacyIsEnabled(data) {
    if (data) {
        return EnabledFlags.SbxEnabled;
    }
    else {
        return EnabledFlags.Disabled;
    }
}
function isSerializedIsEnabledDataV1(value) {
    return isObject(value) &&
        isBoolean(value.chrome) &&
        isBoolean(value.firefox) &&
        isBoolean(value.edge);
}
function isSerializedIsEnabledDataV12(value) {
    return isObject(value) &&
        isBoolean(value.chrome) &&
        isBoolean(value.firefox) &&
        isBoolean(value.edge) &&
        isBoolean(value.edgeChromium);
}
function isSerializedIsEnabledDataV14(value) {
    return isObject(value) &&
        isBoolean(value.chrome) &&
        isBoolean(value.firefox) &&
        isBoolean(value.edge) &&
        isBoolean(value.edgeChromium) &&
        isBoolean(value.secureBrowser) &&
        isBoolean(value.sbxSecureBrowserMode);
}
function isSerializedIsEnabledDataV21(value) {
    return isObject(value) &&
        isBoolean(value.chrome) &&
        isBoolean(value.firefox) &&
        isBoolean(value.edge) &&
        isBoolean(value.edgeChromium) &&
        isBoolean(value.secureBrowser) &&
        isBoolean(value.sbxSecureBrowserMode) &&
        isBoolean(value.fullyVirtualisedFirefox);
}
function isSerializedIsEnabledDataV22(value) {
    return isObject(value) &&
        isNumber(value.chrome) &&
        isNumber(value.firefox) &&
        isNumber(value.edgeChromium) &&
        isNumber(value.secureBrowser) &&
        isBoolean(value.sbxSecureBrowserMode) &&
        isBoolean(value.fullyVirtualisedFirefox);
}
function parseSerializedIsEnabledData(data) {
    if (isSerializedIsEnabledDataV22(data)) {
        return data;
    }
    else if (isSerializedIsEnabledDataV21(data)) {
        return {
            chrome: convertLegacyIsEnabled(data.chrome),
            firefox: convertLegacyIsEnabled(data.firefox),
            edgeChromium: convertLegacyIsEnabled(data.edgeChromium),
            secureBrowser: convertLegacyIsEnabled(data.secureBrowser),
            sbxSecureBrowserMode: data.sbxSecureBrowserMode,
            fullyVirtualisedFirefox: data.fullyVirtualisedFirefox,
        };
    }
    else if (isSerializedIsEnabledDataV14(data)) {
        return {
            chrome: convertLegacyIsEnabled(data.chrome),
            firefox: convertLegacyIsEnabled(data.firefox),
            edgeChromium: convertLegacyIsEnabled(data.edgeChromium),
            secureBrowser: convertLegacyIsEnabled(data.secureBrowser),
            sbxSecureBrowserMode: data.sbxSecureBrowserMode,
            fullyVirtualisedFirefox: false,
        };
    }
    else if (isSerializedIsEnabledDataV12(data)) {
        return {
            chrome: convertLegacyIsEnabled(data.chrome),
            firefox: convertLegacyIsEnabled(data.firefox),
            edgeChromium: convertLegacyIsEnabled(data.edgeChromium),
            secureBrowser: EnabledFlags.Disabled,
            sbxSecureBrowserMode: false,
            fullyVirtualisedFirefox: false,
        };
    }
    else if (isSerializedIsEnabledDataV1(data)) {
        return {
            chrome: convertLegacyIsEnabled(data.chrome),
            firefox: convertLegacyIsEnabled(data.firefox),
            edgeChromium: EnabledFlags.Disabled,
            secureBrowser: EnabledFlags.Disabled,
            sbxSecureBrowserMode: false,
            fullyVirtualisedFirefox: false,
        };
    }
    else {
        return {
            chrome: EnabledFlags.Disabled,
            firefox: EnabledFlags.Disabled,
            edgeChromium: EnabledFlags.Disabled,
            secureBrowser: EnabledFlags.Disabled,
            sbxSecureBrowserMode: false,
            fullyVirtualisedFirefox: false,
        };
    }
}
function getEnabledFlagsForBrowser(browser, data) {
    if (data.sbxSecureBrowserMode) {
        return data.secureBrowser;
    }
    switch (browser) {
        case Browser.chrome:
            return data.chrome;
        case Browser.firefox:
            return data.firefox;
        case Browser.edgeChromium:
            return data.edgeChromium;
    }
    logError(`getEnabledFlagsForBrowser: Unknown browser: ${browser}`);
    return EnabledFlags.Disabled;
}

;// CONCATENATED MODULE: ./chrome-new-tab-urls.ts
const chromeNewTabPageUrls = [
    "https://duckduckgo.com/chrome_newtab",
    "https://go.mail.ru/chrome/newtab/",
    "https://www.bing.com/chrome/newtab",
    "https://www.yandex.by/chrome/newtab",
    "https://www.yandex.com.tr/chrome/newtab",
    "https://www.yandex.kz/chrome/newtab",
    "https://www.yandex.ru/chrome/newtab",
    "https://www.yandex.ua/chrome/newtab",
];

;// CONCATENATED MODULE: ./config.ts






class StaticConfig {
}
StaticConfig.phishingSourceSitesVersion = 1;
StaticConfig.phishingNavigationSequencesVersion = 2;
class Config {
    constructor() {
        this.trustedUrls = [];
        this.untrustedUrls = [];
        this.userTrustedOrigins = [];
        this.userUntrustedOrigins = [];
        this.isEnabled = {
            chrome: EnabledFlags.SbxEnabled,
            firefox: EnabledFlags.SbxEnabled,
            edgeChromium: EnabledFlags.SbxEnabled,
            secureBrowser: EnabledFlags.SbxEnabled,
            sbxSecureBrowserMode: false,
            fullyVirtualisedFirefox: false,
        };
        this.openPhishingLinksInSecureBrowser = false;
        this.prioritiseTrustedSites = false;
        this.promptForUncategorized = false;
        this.isHPConsumerMachine = false;
        this.secureBrowserRedirectTrustedSites = false;
        this.closeLaunchedPageTabs = false;
        this.ipIsIndependentOfSureClick = false;
        this.sureClickStatus = SureClickStatus.Enabled;
        this.productType = ProductTypes.Unknown;
        this.phishingSourceSites = undefined;
        this.phishingNavigationSequences = undefined;
        this.newTabPageUrls = {
            chrome: chromeNewTabPageUrls,
            firefox: [],
            edge: [],
            edgeChromium: []
        };
        this.linkProtectionServiceConsumers = undefined;
        this.intranetSites = undefined;
        this.ufBlockedCategories = [];
        this.ufDomainAgeCheckEnabled = false;
        this.ufDomainAgeCheckMinDays = 30;
        this.ufStatusCodeCheckEnabled = false;
        this.ipDomainAgeCheckEnabled = false;
        this.ipDomainAgeCheckMinDays = 30;
        this.reputableSites = {
            index: 0,
            total: 0,
            reputableSites: []
        };
        this.sbxEnabledFeatures = {
            linkProtection: false,
            fileURLProtection: false,
            pdfProtection: false,
            downloadProtection: false
        };
    }
    get isFullyVirtualisedFirefox() {
        return currentBrowser === Browser.firefox && this.isEnabled.fullyVirtualisedFirefox;
    }
    get sbxSecureBrowserMode() {
        return this.isEnabled.sbxSecureBrowserMode;
    }
    get isVirtualisedBrowser() {
        return this.isFullyVirtualisedFirefox || this.sbxSecureBrowserMode;
    }
    isFlagSet(flag) {
        const flags = getEnabledFlagsForBrowser(currentBrowser, this.isEnabled);
        return (flags & flag) !== 0;
    }
    isSbxEnabled() {
        let enabled = false;
        let disabledBecauseOfSureClickStatus = false;
        if (!this.isVirtualisedBrowser && this.isFlagSet(EnabledFlags.SbxEnabled)) {
            if (this.sureClickStatus === SureClickStatus.Enabled) {
                enabled = true;
            }
            else {
                disabledBecauseOfSureClickStatus = true;
            }
        }
        return { enabled, disabledBecauseOfSureClickStatus };
    }
    isIpEnabled() {
        let enabled = false;
        let disabledBecauseOfSureClickStatus = false;
        if (!this.isFullyVirtualisedFirefox && this.isFlagSet(EnabledFlags.IpEnabled)) {
            if (this.ipIsIndependentOfSureClick || this.sureClickStatus === SureClickStatus.Enabled) {
                enabled = true;
            }
            else {
                disabledBecauseOfSureClickStatus = true;
            }
        }
        return { enabled, disabledBecauseOfSureClickStatus };
    }
    isUfEnabled() {
        const enabled = !this.isFullyVirtualisedFirefox && this.isFlagSet(EnabledFlags.UfEnabled);
        const disabledBecauseOfSureClickStatus = false;
        return { enabled, disabledBecauseOfSureClickStatus };
    }
    isAiBrandLogoProtectionEnabled() {
        const { enabled: isIpEnabled, disabledBecauseOfSureClickStatus } = this.isIpEnabled();
        return {
            enabled: isIpEnabled && this.isFlagSet(EnabledFlags.AiBrandProtectionEnabled),
            disabledBecauseOfSureClickStatus
        };
    }
    get sbxEnabled() { return this.isSbxEnabled().enabled; }
    get ipEnabled() { return this.isIpEnabled().enabled; }
    get ufEnabled() { return this.isUfEnabled().enabled; }
    get aiBrandLogoProtectionEnabled() { return this.isAiBrandLogoProtectionEnabled().enabled; }
    ;
    get isExtensionEnabled() {
        const featureIsEnabledResults = [this.isSbxEnabled(), this.isIpEnabled(), this.isUfEnabled()];
        const enabled = featureIsEnabledResults.some(result => result.enabled);
        const disabledBecauseOfSureClickStatus = !enabled && featureIsEnabledResults.some(result => result.disabledBecauseOfSureClickStatus);
        return { enabled, disabledBecauseOfSureClickStatus };
    }
    get isEnterpriseProduct() {
        switch (this.productType) {
            case ProductTypes.LegacyEnterprise:
            case ProductTypes.Unbundled:
                return true;
            default:
                return false;
        }
    }
    get identityProtection() {
        if (this.ipEnabled && maybe_some(this.validatedIdentityProtectionConfig)) {
            return { enabled: true, config: this.validatedIdentityProtectionConfig };
        }
        else {
            return { enabled: false, config: undefined };
        }
    }
    setIdentityProtection(config) {
        if (maybe_some(config)) {
            this._threatCloudOrigin = config.cloudUrl;
            this._threatCloudAuthParam = config.cloudAuth;
            const validatedOpMode = validateOperationMode(config.operationMode);
            if (maybe_some(validatedOpMode)) {
                this.validatedIdentityProtectionConfig = Object.assign(Object.assign({}, config), { operationMode: validatedOpMode });
                return;
            }
        }
        this.validatedIdentityProtectionConfig = undefined;
    }
    get threatCloudOrigin() {
        return this._threatCloudOrigin;
    }
    get threatCloudAuthParam() {
        return this._threatCloudAuthParam;
    }
}

;// CONCATENATED MODULE: ../lib/common/placement-manager.ts





class PlacementManager {
    constructor(trustedUrlTracker, fileUrlTracker, newTabPageUrlTracker, configNotifier) {
        this.trustedUrlTracker = trustedUrlTracker;
        this.fileUrlTracker = fileUrlTracker;
        this.newTabPageUrlTracker = newTabPageUrlTracker;
        this.shouldOpenPhishingLinksInSecureBrowser = false;
        this.phishingSourceSites = new EmptyPhishingSourceSites();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (maybe_some(config.phishingSourceSites)) {
            if (config.phishingSourceSites.version === StaticConfig.phishingSourceSitesVersion) {
                this.phishingSourceSites = new PhishingSourceSites(config.phishingSourceSites);
            }
        }
        this.shouldOpenPhishingLinksInSecureBrowser = config.openPhishingLinksInSecureBrowser;
    }
    isNewTabPageUrl(url) {
        return this.newTabPageUrlTracker.isNewTabPageUrl(url);
    }
    isTrustedUrl(url) {
        return this.trustedUrlTracker.isTrustedUrl(url);
    }
    isTrustedFileUrl(fileUrl) {
        return this.fileUrlTracker.isFileUrlTrusted(fileUrl);
    }
    isPhishingSourceSite(url) {
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return undefined;
        }
        return this.phishingSourceSites.isPhishingSourceSite(origin);
    }
    isWebMailSite(url) {
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return undefined;
        }
        return this.phishingSourceSites.isWebMailSite(origin);
    }
    siteRequiresAuth(url) {
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return undefined;
        }
        return this.phishingSourceSites.siteRequiresAuth(origin);
    }
    isAuthSite(url) {
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return undefined;
        }
        return this.phishingSourceSites.isAuthSite(origin);
    }
    findGroups(url) {
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return undefined;
        }
        return this.phishingSourceSites.findGroups(origin);
    }
    shouldBlockNavigation(tabType, navType, methodType, sourceURL) {
        const sourceOrigin = origin_parseOrigin(sourceURL);
        if (maybe_none(sourceOrigin)) {
            return undefined;
        }
        return this.phishingSourceSites.shouldBlockNavigation(tabType, navType, methodType, sourceOrigin);
    }
}

;// CONCATENATED MODULE: ../lib/common/trusted-url-tracker.ts








const sureClickAdvancedHelpHostname = "https://help-sureclickadvanced.bromium-online.com";
const sureClickHelpHostname = "https://help-sureclick.bromium-online.com";
const helpHostnames = [sureClickAdvancedHelpHostname, sureClickHelpHostname];
const originMatcherOptions = new OriginParseOptions({ allowWildcards: true, allowMissingWildcardScheme: true });
const originHashOptions = new OriginHashOptions({ ignoreHttpHttpsDifference: true, ignorePort: true });
class TrustedUrlTracker {
    constructor(configNotifier, messageSender, cache) {
        this.messageSender = messageSender;
        this.cache = cache;
        this.trustedOrigins = new OriginMatcherWithNetblockSupport();
        this.untrustedOrigins = new OriginMatcherWithNetblockSupport();
        this.pendingReputableSites = [];
        this.reputableOrigins = new OriginExpiryMatcher();
        this.userTrustedOrigins = makeOriginSet(originHashOptions);
        this.userUntrustedOrigins = makeOriginSet(originHashOptions);
        this.prioritiseTrustedSites = false;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        configNotifier.addConfigListenerForKey(config => this.updateReputation(config), ConfigKey.reputableSites);
        this.sbxTrustedOrigins = parseOriginSet(helpHostnames, originHashOptions);
        this.cache.reputableSites.getCachedValue().then(reputableOrigins => this.setReputableOrigins(reputableOrigins));
    }
    onConfigChanged(config) {
        this.trustedOrigins = parseOriginMatcherWithNetblockSupportWithIntranetSites(config.trustedUrls, config.intranetSites, originMatcherOptions);
        this.untrustedOrigins = parseOriginMatcherWithNetblockSupport(config.untrustedUrls, originMatcherOptions);
        this.userTrustedOrigins = parseOriginSet(config.userTrustedOrigins, originHashOptions);
        this.userUntrustedOrigins = parseOriginSet(config.userUntrustedOrigins, originHashOptions);
        this.prioritiseTrustedSites = config.prioritiseTrustedSites;
    }
    updateReputation(config) {
        const index = config.reputableSites.index;
        if (index === 0) {
            this.pendingReputableSites = [];
        }
        let length = this.pendingReputableSites.length;
        if (length !== index) {
            logError(`Reputable site index mismatch: index=${index} length=${length}`);
            return;
        }
        this.pendingReputableSites = this.pendingReputableSites.concat(config.reputableSites.reputableSites);
        length = this.pendingReputableSites.length;
        const total = config.reputableSites.total;
        if (length > total) {
            logError(`Reputable site length mismatch: total=${total} length=${length}`);
            return;
        }
        if (length === total) {
            this.setReputableOrigins(this.pendingReputableSites);
            this.cache.reputableSites.setCachedValue(this.pendingReputableSites);
        }
    }
    setReputableOrigins(reputableSites) {
        this.reputableOrigins = parseOriginExpiryMatcher(reputableSites, originMatcherOptions);
    }
    trustUrl(url, trust) {
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return;
        }
        this.trustOrigin(origin, trust);
    }
    trustOrigin(origin, trust) {
        if (trust) {
            if (!this.userTrustedOrigins.add(origin)) {
                return;
            }
            const request = new AddUserTrustedOriginV1(origin.toString());
            this.messageSender.sendMessage(MessageType.addUserTrustedOriginV1, request);
        }
        else {
            if (!this.userUntrustedOrigins.add(origin)) {
                return;
            }
            const request = new AddUserUntrustedOriginV1(origin.toString());
            this.messageSender.sendMessage(MessageType.addUserUntrustedOriginV1, request);
        }
    }
    isTrustedUrl(url) {
        if (isExtensionUrl(url)) {
            return true;
        }
        if (isBrowserUrl(url)) {
            return true;
        }
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return undefined;
        }
        if (this.sbxTrustedOrigins.has(origin)) {
            return true;
        }
        const handleUntrustedOrigin = () => {
            if (this.untrustedOrigins.has(origin)) {
                return false;
            }
            return undefined;
        };
        const handleTrustedOrigin = () => {
            if (this.trustedOrigins.has(origin)) {
                return true;
            }
            return undefined;
        };
        const handleUserUntrustedOrigin = () => {
            if (this.userUntrustedOrigins.has(origin)) {
                return false;
            }
            return undefined;
        };
        const handleUserTrustedOrigin = () => {
            if (this.userTrustedOrigins.has(origin)) {
                return true;
            }
            return undefined;
        };
        const handleReputableOrigin = () => {
            if (this.reputableOrigins.has(origin)) {
                return true;
            }
            return undefined;
        };
        const originHandlers = this.prioritiseTrustedSites ? [
            handleTrustedOrigin,
            handleUntrustedOrigin,
            handleUserTrustedOrigin,
            handleUserUntrustedOrigin,
            handleReputableOrigin
        ] : [
            handleUntrustedOrigin,
            handleTrustedOrigin,
            handleUserUntrustedOrigin,
            handleUserTrustedOrigin,
            handleReputableOrigin
        ];
        for (const originHandler of originHandlers) {
            const result = originHandler();
            if (maybe_some(result)) {
                return result;
            }
        }
        return undefined;
    }
}

;// CONCATENATED MODULE: ../lib/common/url-encoder.ts


class UrlEncoder {
    constructor(url) {
        this.url = url;
        this.queryParams = new Array();
    }
    addUrlQueryParam(name, value) {
        this.addQueryParam(name, URLToString(value));
    }
    addQueryParam(name, value) {
        this.queryParams.push([name, encodeURIComponent(value)]);
    }
    encodeQueryParam(name, value) {
        return `${name}=${value}`;
    }
    encodeQueryParams() {
        return this.queryParams.map(([name, value]) => this.encodeQueryParam(name, value)).join("&");
    }
    encodeUrl() {
        if (isEmpty(this.queryParams)) {
            return this.url;
        }
        const spec = `${URLToString(this.url)}?${this.encodeQueryParams()}`;
        return url_utils_parseUrl(spec);
    }
}

;// CONCATENATED MODULE: ../lib/host/host-constants.ts
const hostConstants = {
    hostHelperId: "com.bromium.hosthelper",
    blockedPage: "blocked-page.html",
    externalAppLinkNavigator: "external-app-link-navigator-v1.html",
    externalAppLinkPage: "external-app-link-page-v1.html",
    blockedFilePage: "blocked-file-page.html",
    externalAppLinkPagePortName: "com.bromium.external.app.link.page",
    blockedPagePortName: "com.bromium.blocked.page",
    blockedFilePagePortName: "com.bromium.blocked.file.page",
    popupPortName: "com.bromium.popup",
    optionsPortName: "com.bromium.options",
    identityProtectionPortName: "com.bromium.identity.protection",
};

;// CONCATENATED MODULE: ../lib/common/tab-utils.ts




function isValidWindowId(windowId) {
    return maybe_some(windowId) && windowId !== chrome.windows.WINDOW_ID_NONE;
}
function isValidTabId(tabId) {
    return tabId !== chrome.tabs.TAB_ID_NONE;
}
function hashTabId(tabId, seed = 0) {
    return murmurHash(tabId, seed);
}
function isSameTabId(a, b) {
    if (!isValidTabId(a) || !isValidTabId(b)) {
        return false;
    }
    return a === b;
}
const TabsAPIChromeNewTabSpec = "chrome://newtab";
const TabsAPIFirefoxNewTabSpecs = ["about:newtab", "about:home"];
const TabsAPIEdgeChromiumNewTabSpec = "edge://newtab";
function parseTabsAPIBrowserNewTabURLs() {
    const tabsAPIBrowserNewTabSpecs = [
        [Browser.chrome, [TabsAPIChromeNewTabSpec]],
        [Browser.firefox, TabsAPIFirefoxNewTabSpecs],
        [Browser.edgeChromium, [TabsAPIEdgeChromiumNewTabSpec]]
    ];
    const tabsAPIBrowserNewTabURLs = new Map();
    for (const [browser, specs] of tabsAPIBrowserNewTabSpecs) {
        const urls = specs.map(url_utils_parseUrl).filter(maybe_some);
        if (urls.length > 0) {
            tabsAPIBrowserNewTabURLs.set(browser, urls);
        }
    }
    return tabsAPIBrowserNewTabURLs;
}

;// CONCATENATED MODULE: ../lib/common/port-utils.ts




function readPortTabId(port) {
    var _a, _b;
    const tabId = (_b = (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.tab) === null || _b === void 0 ? void 0 : _b.id;
    if (maybe_none(tabId) || !isValidTabId(tabId)) {
        return undefined;
    }
    return tabId;
}
function readPortPageUrl(port) {
    var _a;
    const urlSpec = (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.url;
    if (maybe_none(urlSpec)) {
        return;
    }
    return url_utils_parseUrl(urlSpec);
}
function readPortTabUrl(port) {
    var _a, _b;
    const urlSpec = (_b = (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.tab) === null || _b === void 0 ? void 0 : _b.url;
    if (none(urlSpec)) {
        return undefined;
    }
    return parseUrl(urlSpec);
}
function readPortFrameId(port) {
    var _a;
    return (_a = port === null || port === void 0 ? void 0 : port.sender) === null || _a === void 0 ? void 0 : _a.frameId;
}
function portToString(port) {
    if (port === undefined) {
        return "undefined";
    }
    return string_utils_toString({
        name: port.name,
        tabId: readPortTabId(port),
        frameId: readPortFrameId(port),
        pageUrl: readPortPageUrl(port)
    });
}

;// CONCATENATED MODULE: ./history.ts









const extensionUrlOriginParseOptions = new OriginParseOptions({
    allowChromeExtensionScheme: true,
    allowFirefoxExtensionScheme: true
});
const ownOrigin = origin_parseOrigin(chrome.runtime.getURL("manifest.json"), extensionUrlOriginParseOptions);
function isOwnExtensionUrl(url) {
    return origin_isSameOrigin(ownOrigin, origin_parseOrigin(url, extensionUrlOriginParseOptions));
}
function removeUrlFromHistory(url) {
    log_log(`Removing history entry for "${url}"`);
    chrome.history.deleteUrl({ url: url });
}
function removeExtensionPageFromHistoryAfterClosing(port) {
    const pageUrl = readPortPageUrl(port);
    if (maybe_some(pageUrl) && isOwnExtensionUrl(pageUrl)) {
        removeUrlFromHistory(pageUrl.toString());
    }
}
class HistorySeeder {
    constructor(configNotifier, onConfigured, phishingCategoryTracker) {
        this.phishingCategoryTracker = phishingCategoryTracker;
        this.shouldSeed = false;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        onConfigured.registerListener(() => {
            const key = StorageKey.historySeeder;
            chrome.storage.local.get(key, result => {
                const storedValue = result[key];
                if (storedValue === null || storedValue === void 0 ? void 0 : storedValue.hasSeededFromHistory) {
                    return;
                }
                if (this.shouldSeed && maybe_some(this.threshold)) {
                    this.seedFromHistory(this.threshold);
                    const newStoredValue = { hasSeededFromHistory: true };
                    chrome.storage.local.set({ [key]: newStoredValue });
                }
            });
        });
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            const ipConfig = config.identityProtection.config;
            this.shouldSeed = isInputAllowableOpMode(ipConfig.operationMode)
                && ipConfig.allowUserToEnableInput
                && ipConfig.userAllowedHosts.length === 0;
            this.threshold = ipConfig.seedFromHistoryThreshold;
        }
        else {
            this.shouldSeed = false;
        }
    }
    seedFromHistory(threshold) {
        log_log("Seeding Identity Protection user allowed hosts from history");
        chrome.history.search({ text: "", startTime: 0, maxResults: 10000 }, items => {
            var _a;
            const hostnameOccurances = new Map();
            for (const item of items) {
                if (maybe_none(item.url) || maybe_none(item.visitCount)) {
                    continue;
                }
                const url = url_utils_parseUrl(item.url);
                if (maybe_none(url) || url.protocol !== Scheme.HTTPS) {
                    continue;
                }
                const newOccurances = ((_a = hostnameOccurances.get(url.hostname)) !== null && _a !== void 0 ? _a : 0) + item.visitCount;
                hostnameOccurances.set(url.hostname, newOccurances);
            }
            const hostnamesToAllow = new Array();
            for (let [hostname, occurances] of hostnameOccurances) {
                if (occurances >= threshold) {
                    hostnamesToAllow.push(hostname);
                }
            }
            this.phishingCategoryTracker.userAllowHostnames(hostnamesToAllow);
        });
    }
}

;// CONCATENATED MODULE: ../lib/common/connection.ts
var ConnectionState;
(function (ConnectionState) {
    ConnectionState[ConnectionState["Connecting"] = 0] = "Connecting";
    ConnectionState[ConnectionState["Handshaking"] = 1] = "Handshaking";
    ConnectionState[ConnectionState["Connected"] = 2] = "Connected";
    ConnectionState[ConnectionState["Disconnecting"] = 3] = "Disconnecting";
    ConnectionState[ConnectionState["Disconnected"] = 4] = "Disconnected";
})(ConnectionState || (ConnectionState = {}));
class ConnectionStateChangedEvent {
    constructor(oldState, newState) {
        this.oldState = oldState;
        this.newState = newState;
    }
}

;// CONCATENATED MODULE: ../lib/common/message-encoder.ts
function encodeMessage(type, payload) {
    return { type: type, payload: payload };
}

;// CONCATENATED MODULE: ../lib/common/handshaker.ts
class HandshakenEvent {
    constructor(negotiatedVersion) {
        this.negotiatedVersion = negotiatedVersion;
    }
}

;// CONCATENATED MODULE: ../lib/common/message-sender.ts

class MessageSender {
    constructor(doSendMessage) {
        this.doSendMessage = doSendMessage;
        this.sendMessage = (type, payload) => {
            const message = encodeMessage(type, payload);
            return this.doSendMessage(message);
        };
    }
}

;// CONCATENATED MODULE: ../lib/common/message-port-channel.ts














var Negotiation;
(function (Negotiation) {
    Negotiation[Negotiation["None"] = 0] = "None";
    Negotiation[Negotiation["NegotiateProtocolVersion"] = 1] = "NegotiateProtocolVersion";
})(Negotiation || (Negotiation = {}));
class MessagePortChannel {
    constructor(connectToPort, onConnect, onDisconnect, onPortError, onNegotiationError, messageRouter, negotiation) {
        this.connectToPort = connectToPort;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.onPortError = onPortError;
        this.onNegotiationError = onNegotiationError;
        this.messageRouter = messageRouter;
        this.negotiation = negotiation;
        this.onHandshaken = new EventDispatcher();
        this.onConnectionStateChanged = new EventDispatcher();
        this.messages = new Array();
        this._connState = ConnectionState.Disconnected;
        this._negotiatedVersion = undefined;
        this.messageSender = new MessageSender((message) => this.sendMessage(message));
    }
    disconnectPort(port) {
        port.disconnect();
        this.handleDisconnect(port);
    }
    connect() {
        if (this.connState !== ConnectionState.Disconnected) {
            throw new Error(`MessagePortChannel.connect called with connState == ${this.connState}`);
        }
        const shouldHandshake = this.negotiation === Negotiation.NegotiateProtocolVersion;
        this.connState = ConnectionState.Connecting;
        this.connectToPort.then((port) => {
            if (this.connState === ConnectionState.Disconnecting) {
                this.disconnectPort(port);
                return;
            }
            this.port = port;
            this.port.onMessage.addListener((encodeMessage, port) => this.onMessage(encodeMessage, port));
            this.port.onDisconnect.addListener((port) => this.handleDisconnect(port));
            if (shouldHandshake) {
                this.connState = ConnectionState.Handshaking;
                const handshake = new HandshakeV1(supportedProtocolVersions);
                const message = encodeMessage(MessageType.handshakeV1, handshake);
                this.postMessage(message);
            }
            else {
                this.sendQueuedMessages();
                this.connState = ConnectionState.Connected;
                this.onConnect(this.port);
            }
        });
        if (shouldHandshake) {
            setTimeout(() => {
                if (this.connState === ConnectionState.Handshaking) {
                    this.onNegotiationError(new Error("Handshake timed out after 60s"));
                }
            }, 60000);
        }
    }
    disconnect() {
        switch (this.connState) {
            case ConnectionState.Disconnected:
                break;
            case ConnectionState.Disconnecting:
                break;
            case ConnectionState.Connecting:
                this.connState = ConnectionState.Disconnecting;
                break;
            case ConnectionState.Handshaking:
                if (maybe_some(this.port)) {
                    this.disconnectPort(this.port);
                }
                break;
            case ConnectionState.Connected:
                if (maybe_some(this.port)) {
                    this.disconnectPort(this.port);
                }
                break;
        }
    }
    postMessage(message) {
        try {
            if (maybe_none(this.port)) {
                throw new Error("MessagePortChannel.postMessage: this.port === undefined");
            }
            if (!isFrequentlySentMessageType(message.type)) {
                this.log(`MessagePortChannel.postMessage: message: ${messageToString(message)}`);
            }
            this.port.postMessage(message);
        }
        catch (e) {
            if (errors_isError(e)) {
                this.onPortError(e);
            }
            else {
                const error = new Error(`Unknown error caught in postMessage: ${string_utils_toString(e)}`);
                this.onPortError(error);
            }
        }
    }
    sendQueuedMessages() {
        for (const message of this.messages) {
            this.postMessage(message);
        }
        this.messages = [];
    }
    queueMessage(message) {
        this.messages.push(message);
    }
    sendMessage(message) {
        if (this.connState === ConnectionState.Connected) {
            this.postMessage(message);
        }
        else {
            this.queueMessage(message);
        }
    }
    onMessage(encodedMessage, port) {
        if (this.connState === ConnectionState.Handshaking) {
            this.log(`MessagePortChannel.onMessage: message: ${string_utils_toString(encodedMessage)} port: ${portToString(port)}`);
            let message = decodeMessage(encodedMessage);
            if (maybe_none(message)) {
                this.onNegotiationError(new Error(`Invalid message before handshaken: ${string_utils_toString(encodedMessage)}`));
            }
            else if (message.type !== MessageType.handshakeV1) {
                this.onNegotiationError(new Error(`Message before handshaken: ${message.type}`));
            }
            else if (maybe_none(this.port)) {
                this.onPortError(new Error("MessagePortChannel.onMessage: this.port === undefined"));
            }
            else {
                const handshake = message.payload;
                for (const supportedVersion of supportedProtocolVersions) {
                    if (handshake.versions.indexOf(supportedVersion) >= 0) {
                        this._negotiatedVersion = supportedVersion;
                        this.log(`Negotiated protocol version: ${this._negotiatedVersion}`);
                        this.sendQueuedMessages();
                        this.connState = ConnectionState.Connected;
                        this.onHandshaken.dispatchEvent(new HandshakenEvent(this._negotiatedVersion));
                        this.onConnect(this.port);
                        return;
                    }
                }
                this.onNegotiationError(new Error(`No supported version received in handshake: ${handshake.versions}`));
            }
        }
        else if (this.connState == ConnectionState.Connected) {
            this.messageRouter.onMessageReceived(port, encodedMessage);
        }
    }
    handleDisconnect(port) {
        if (this.connState === ConnectionState.Disconnected) {
            return;
        }
        this.connState = ConnectionState.Disconnected;
        this.port = undefined;
        this.onDisconnect(port);
    }
    shouldLogMessage() {
        if (this.negotiation === Negotiation.None) {
            return true;
        }
        return maybe_some(this.negotiatedVersion) && shouldLogMessage(this.negotiatedVersion);
    }
    log(message) {
        if (this.shouldLogMessage()) {
            log_log(message);
        }
        else {
            console.log(message);
        }
    }
    logError(errorOrMessage) {
        logError(errorOrMessage);
    }
    get connState() {
        return this._connState;
    }
    set connState(newState) {
        const oldState = this._connState;
        this._connState = newState;
        this.onConnectionStateChanged.dispatchEvent(new ConnectionStateChangedEvent(oldState, newState));
    }
    get isHandshaken() {
        return this.connState === ConnectionState.Connected;
    }
    get negotiatedVersion() {
        return this._negotiatedVersion;
    }
    get connectionState() {
        return this.connState;
    }
}
class GenericMessagePortChannel extends MessagePortChannel {
    constructor(connectToPort, onConnect, onDisconnect, messageRouter, negotiation) {
        super(connectToPort, onConnect, onDisconnect, (e) => { console.error(e); }, (e) => { console.error(e); }, messageRouter, negotiation);
    }
}

;// CONCATENATED MODULE: ../lib/common/page-port-controller.ts







var page_port_controller_ConnectionState;
(function (ConnectionState) {
    ConnectionState[ConnectionState["disconnected"] = 0] = "disconnected";
    ConnectionState[ConnectionState["connecting"] = 1] = "connecting";
    ConnectionState[ConnectionState["connected"] = 2] = "connected";
})(page_port_controller_ConnectionState || (page_port_controller_ConnectionState = {}));
class PagePortController {
    constructor(tabId, port, onConnect, onDisconnect, messageSender, onConfigured = new DummyOnConfigured()) {
        this.tabId = tabId;
        this.port = port;
        this.onConnect = onConnect;
        this.onDisconnect = onDisconnect;
        this.messageSender = messageSender;
        this.onConfigured = onConfigured;
        this.registerMessagePayloadHandler = (type, handler) => {
            this.messageRouter.registerMessagePayloadHandler(type, handler);
        };
        this.sendMessage = (type, payload) => this.pageChannel.messageSender.sendMessage(type, payload);
        this.messageRouter = new GenericMessageRouter();
        this.connectionState = page_port_controller_ConnectionState.disconnected;
        this.pageChannel = new GenericMessagePortChannel(port, (port) => { this.onPageConnected(port); }, (port) => { this.onPageDisconnected(port); }, this.messageRouter, Negotiation.None);
        this.forwardMessageTypeToHelper(MessageType.logMessageV1);
    }
    registerMessageHandler(type, handler) {
        this.messageRouter.registerMessageHandler(type, handler);
    }
    registerManyMessageHandler(types, handler) {
        this.messageRouter.registerManyMessageHandler(types, handler);
    }
    forwardMessageTypeToHelper(type) {
        this.registerMessageHandler(type, message => this.forwardMessageToHelper(message));
    }
    forwardMessageTypesToHelper(types) {
        this.registerManyMessageHandler(types, message => this.forwardMessageToHelper(message));
    }
    connect() {
        if (this.connectionState === page_port_controller_ConnectionState.disconnected) {
            this.connectionState = page_port_controller_ConnectionState.connecting;
            this.pageChannel.connect();
        }
    }
    sendExtensionReady() {
        this.sendMessage(MessageType.extensionReadyV1, new ExtensionReadyV1(this.tabId));
    }
    onPageConnected(port) {
        log_log(`PagePortController.onPageConnected: tabId: ${this.tabId} frameId: ${readPortFrameId(port)}`);
        this.connectionState = page_port_controller_ConnectionState.connected;
        this.onConfigured.registerListener(() => {
            var _a;
            if (this.connectionState === page_port_controller_ConnectionState.connected) {
                this.sendExtensionReady();
                (_a = this.onConnect) === null || _a === void 0 ? void 0 : _a.call(this, port);
            }
        });
    }
    onPageDisconnected(port) {
        var _a;
        log_log(`PagePortController.onPageDisconnected: tabId: ${this.tabId} frameId: ${readPortFrameId(port)}`);
        this.connectionState = page_port_controller_ConnectionState.disconnected;
        (_a = this.onDisconnect) === null || _a === void 0 ? void 0 : _a.call(this, port);
    }
    forwardMessageToHelper(message) {
        this.messageSender.sendMessage(message.type, message.payload);
    }
}

;// CONCATENATED MODULE: ../lib/common/page-port-resolver.ts




class PagePortResolver {
    constructor(portName, onUnresolvedPortConnected, isPageURL) {
        this.portName = portName;
        this.onUnresolvedPortConnected = onUnresolvedPortConnected;
        this.isPageURL = isPageURL;
        this.resolvers = new Map();
        chrome.runtime.onConnect.addListener(this.onPortConnected.bind(this));
    }
    onPortConnected(port) {
        if (!compareStrings(port.name, this.portName)) {
            return;
        }
        const url = readPortPageUrl(port);
        if (maybe_none(url)) {
            return;
        }
        if (!this.isPageURL(url)) {
            return;
        }
        const tabId = readPortTabId(port);
        if (maybe_none(tabId)) {
            return;
        }
        const resolve = this.resolvers.get(tabId);
        if (maybe_none(resolve)) {
            this.onUnresolvedPortConnected(tabId, port);
            return;
        }
        this.resolvers.delete(tabId);
        resolve(port);
    }
    resolvePort(tabId) {
        return makePromiseAsync((resolve) => {
            this.resolvers.set(tabId, resolve);
        });
    }
}

;// CONCATENATED MODULE: ../lib/host/blocked-page-options.ts
var OptionNames;
(function (OptionNames) {
    OptionNames["navigateToSpec"] = "navigateSpec";
    OptionNames["blockedSpec"] = "blockedSpec";
    OptionNames["contentType"] = "contentType";
    OptionNames["rememberDecisionsDefault"] = "rememberDecisionsDefault";
    OptionNames["learnMoreURL"] = "learnMoreURL";
    OptionNames["launchedSpec"] = "launchedSpec";
    OptionNames["showLaunchedPageButtons"] = "showLaunchedPageButtons";
})(OptionNames || (OptionNames = {}));

;// CONCATENATED MODULE: ./blocked-page-controller.ts

















class BlockedPagePageController {
    constructor(tabId, port, onConfigured, onTrustUrl, onDisconnect, hostHelpermessageSender) {
        this.tabId = tabId;
        this.port = port;
        this.onTrustUrl = onTrustUrl;
        this.onDisconnect = onDisconnect;
        this.pagePortController = new PagePortController(tabId, port, undefined, (port) => this.onPageDisconnnected(port), hostHelpermessageSender, onConfigured);
        this.pagePortController.registerMessagePayloadHandler(MessageType.trustUrlV8, (message) => this.handleTrustUrl(message));
        this.pagePortController.connect();
    }
    onPageDisconnnected(port) {
        this.onDisconnect(port);
    }
    handleTrustUrl(trustUrlMessage) {
        const navigateToURL = url_utils_parseUrl(trustUrlMessage.navigateToUrlSpec);
        const blockedURL = url_utils_parseUrl(trustUrlMessage.blockedUrlSpec);
        if (maybe_some(navigateToURL) && maybe_some(blockedURL)) {
            this.onTrustUrl(trustUrlMessage.trustUrl, trustUrlMessage.rememberDecision, navigateToURL, blockedURL, this.tabId, trustUrlMessage.contentType);
        }
    }
}
class BrowserLaunchEvent {
    constructor(urlSpec, id, didLaunch) {
        this.urlSpec = urlSpec;
        this.id = id;
        this.didLaunch = didLaunch;
    }
}
class BrowserLauncher {
    constructor(messageRouter, messageSender) {
        this.messageSender = messageSender;
        this.pendingRequests = new Map();
        this.eventDispatcher = new EventDispatcher();
        this.idGenerator = new IdGenerator();
        const blockedPageSpec = chrome.runtime.getURL(hostConstants.blockedPage);
        const blockedPageURL = url_utils_parseUrl(blockedPageSpec);
        if (maybe_none(blockedPageURL)) {
            throw new Error(`Failed to parse blockedPageURL ${blockedPageSpec}`);
        }
        this.blockedPageURL = blockedPageURL;
        messageRouter.registerMessagePayloadHandler(MessageType.launchBrowserResponseV1, (message) => this.onLaunchBrowserResponse(message));
    }
    registerEventHandler(eventHandler) {
        this.eventDispatcher.registerEventHandler(eventHandler);
    }
    onLaunchBrowserResponse(response) {
        const id = response.id;
        const onBrowserLaunchResponse = this.pendingRequests.get(id);
        if (maybe_none(onBrowserLaunchResponse)) {
            logError(`Unexpected launch browser response: ${string_utils_toString(response)}`);
            return;
        }
        log_log(`BrowserLauncher.onLaunchBrowserResponse: ${string_utils_toString(response)}`);
        onBrowserLaunchResponse(response.urlSpec, response.didLaunch);
        this.pendingRequests.delete(id);
        this.eventDispatcher.dispatchEvent(new BrowserLaunchEvent(response.urlSpec, response.id, response.didLaunch));
    }
    createLaunchedPageURL(launchedURL, contentType, showLaunchedPageButtons) {
        const urlEncoder = new UrlEncoder(this.blockedPageURL);
        urlEncoder.addUrlQueryParam(OptionNames.launchedSpec, launchedURL);
        if (maybe_some(contentType)) {
            urlEncoder.addQueryParam(OptionNames.contentType, contentType);
        }
        if (showLaunchedPageButtons) {
            urlEncoder.addQueryParam(OptionNames.showLaunchedPageButtons, "true");
        }
        return urlEncoder.encodeUrl();
    }
    launchBrowser(url, onBrowserLaunchResponse = () => { }) {
        const id = this.idGenerator.generateId();
        const message = new LaunchBrowserRequestV1(URLToString(url), id);
        this.messageSender.sendMessage(MessageType.launchBrowserRequestV1, message);
        this.pendingRequests.set(id, onBrowserLaunchResponse);
    }
    launchBrowserAndCloseTabOrNavigateTab(tabId, url, contentType, closeTab = true, useLaunchPage = true) {
        const failOpen = () => {
            chrome.tabs.update(tabId, { url: URLToString(url) });
        };
        const displayLaunchedPage = () => {
            log_log(`BrowserLauncher.launchBrowserAndCloseTabOrNavigateTab: Displaying launched page for tab ${tabId} ` +
                `rather than closing because it is the only tab.`);
            const launchedPageURL = this.createLaunchedPageURL(url, contentType, false);
            if (maybe_some(launchedPageURL)) {
                chrome.tabs.update(tabId, { url: URLToString(launchedPageURL) });
            }
            else {
                failOpen();
            }
        };
        const onBrowserLaunchResponse = (urlSpec, didLaunch) => {
            if (didLaunch) {
                if (closeTab) {
                    chrome.tabs.query({}, (tabs) => {
                        if (tabs.length > 1) {
                            setTimeout(() => { this.closeTab(tabId); });
                        }
                        else if (useLaunchPage) {
                            displayLaunchedPage();
                        }
                    });
                }
                return;
            }
            failOpen();
        };
        this.launchBrowser(url, onBrowserLaunchResponse);
    }
    onTabClosed(tabId) {
        log_log(`BrowserLauncher.onTabClosed: tabId: ${tabId}`);
    }
    closeTab(tabId) {
        chrome.tabs.remove(tabId, () => this.onTabClosed(tabId));
    }
}
class BlockedPageController {
    constructor(trustedURLTracker, browserLauncher, configNotifier, onConfigured, hostHelpermessageSender) {
        this.trustedURLTracker = trustedURLTracker;
        this.browserLauncher = browserLauncher;
        this.onConfigured = onConfigured;
        this.hostHelpermessageSender = hostHelpermessageSender;
        this.blockedPageControllers = new Map();
        this.rememberDecisionsDefault = false;
        this.idGenerator = new IdGenerator();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        const blockedPageSpec = chrome.runtime.getURL(hostConstants.blockedPage);
        const blockedPageURL = url_utils_parseUrl(blockedPageSpec);
        if (maybe_none(blockedPageURL)) {
            throw new Error(`Failed to parse blockedPageURL ${blockedPageSpec}`);
        }
        this.blockedPageURL = blockedPageURL;
        this.portResolver = new PagePortResolver(hostConstants.blockedPagePortName, (tabId, port) => this.onUnresolvedPortConnected(tabId, port), (url) => this.isBlockedPageURL(url));
    }
    onConfigChanged(config) {
        this.rememberDecisionsDefault = config.promptForUncategorized;
        this.learnMoreURL = config.blockedPageLearnMoreURL;
    }
    onUnresolvedPortConnected(tabId, port) {
        this.addBlockedPageController(tabId, makePromise(() => port));
    }
    isBlockedPageURL(url) {
        if (url === undefined) {
            return false;
        }
        return url_utils_isSameUrl(url, this.blockedPageURL, UrlCompareOptions.IgnoreSearchParams);
    }
    makeBlockedPageURL(navigateToURL, blockedURL, contentType) {
        const urlEncoder = new UrlEncoder(this.blockedPageURL);
        urlEncoder.addUrlQueryParam(OptionNames.navigateToSpec, navigateToURL);
        urlEncoder.addUrlQueryParam(OptionNames.blockedSpec, blockedURL);
        if (maybe_some(contentType)) {
            urlEncoder.addQueryParam(OptionNames.contentType, contentType);
        }
        if (this.rememberDecisionsDefault) {
            urlEncoder.addQueryParam(OptionNames.rememberDecisionsDefault, "true");
        }
        if (maybe_some(this.learnMoreURL)) {
            urlEncoder.addQueryParam(OptionNames.learnMoreURL, this.learnMoreURL);
        }
        const blockedPageURL = urlEncoder.encodeUrl();
        if (maybe_none(blockedPageURL)) {
            return this.blockedPageURL;
        }
        return blockedPageURL;
    }
    addBlockedPageController(tabId, port) {
        const id = this.idGenerator.generateId();
        const controller = new BlockedPagePageController(tabId, port, this.onConfigured, (trustURL, rememberDecision, navigateToURL, blockedURL, tabId, contentType) => this.trustURL(trustURL, rememberDecision, navigateToURL, blockedURL, tabId, contentType, id), port => this.onPageDisconnected(port, id), this.hostHelpermessageSender);
        this.blockedPageControllers.set(id, controller);
    }
    onPageDisconnected(port, id) {
        this.blockedPageControllers.delete(id);
        removeExtensionPageFromHistoryAfterClosing(port);
    }
    trustURL(trustURL, rememberDecision, navigateToURL, blockedURL, tabId, contentType, id) {
        const controller = this.blockedPageControllers.get(id);
        if (maybe_none(controller) ||
            maybe_none(navigateToURL) || !isURL(navigateToURL) ||
            maybe_none(blockedURL) || !isURL(blockedURL)) {
            logError(new Error(`NavigationBlocker.trustURL: invalid parameters: ${string_utils_toString({
                trustURL: trustURL,
                trustURLPermanently: rememberDecision,
                navigateToURL: navigateToURL,
                blockedURL: blockedURL,
                tabId: tabId,
            })}`));
            return;
        }
        if (rememberDecision) {
            this.trustedURLTracker.trustUrl(blockedURL, trustURL);
        }
        if (!trustURL) {
            const shouldCloseTab = parseRawContentType(contentType) !== ContentType.pdf;
            const useLaunchPage = false;
            this.browserLauncher.launchBrowserAndCloseTabOrNavigateTab(tabId, navigateToURL, contentType, shouldCloseTab, useLaunchPage);
        }
    }
    findNavigateToURL(url, phishingNavSequence) {
        if (maybe_none(url)) {
            return undefined;
        }
        if (maybe_none(phishingNavSequence)) {
            return url;
        }
        const navigateToURL = phishingNavSequence.navigateToURL;
        if (maybe_none(navigateToURL)) {
            return url;
        }
        return navigateToURL;
    }
    blockURL(blockedURL, navigateToURL, tabId, contentType = undefined) {
        const port = this.portResolver.resolvePort(tabId);
        this.addBlockedPageController(tabId, port);
        const blockedPageUrl = this.makeBlockedPageURL(navigateToURL, blockedURL, contentType);
        return blockedPageUrl;
    }
    blockNavigation(blockedURL, tabId) {
        return this.blockURL(blockedURL, blockedURL, tabId);
    }
    blockNavigationWithNavSequence(blockedURL, phishingNavSequence, tabId) {
        const navigateToURL = this.findNavigateToURL(blockedURL, phishingNavSequence);
        return this.blockURL(blockedURL, navigateToURL, tabId);
    }
    blockContentType(blockedURL, contentType, phishingNavSequence, tabId) {
        const navigateToURL = this.findNavigateToURL(blockedURL, phishingNavSequence);
        return this.blockURL(blockedURL, navigateToURL, tabId, contentType);
    }
}

;// CONCATENATED MODULE: ./browser-action.ts
var _a;



const actionAPI = (_a = chrome.action) !== null && _a !== void 0 ? _a : chrome.browserAction;
var Colour;
(function (Colour) {
    Colour["red"] = "#FF0000";
    Colour["green"] = "#008000";
    Colour["orange"] = "#ED8B00";
})(Colour || (Colour = {}));
const suppressTabErrors = () => suppressRuntimeErrors(["No tab with id", "Invalid tab ID"]);
class BadgeManager {
    constructor() {
        actionAPI.setBadgeText({ text: "" });
    }
    setTabBadge(tabId, color) {
        actionAPI.setBadgeBackgroundColor({ tabId, color }, () => {
            actionAPI.setBadgeText({ tabId, text: "\u2000" }, suppressTabErrors);
        });
    }
    resetTabBadge(tabId) {
        actionAPI.setBadgeText({ tabId, text: "" }, suppressTabErrors);
    }
}
const normalIcon = {
    path: {
        16: "icons/icon16.png",
        32: "icons/icon32.png",
        64: "icons/icon64.png"
    }
};
const disabledIcon = {
    path: {
        16: "icons/greyscale_icon16.png",
        32: "icons/greyscale_icon32.png",
        64: "icons/greyscale_icon64.png"
    }
};
const errorIcon = {
    path: {
        16: "icons/error_icon16.png",
        32: "icons/error_icon32.png",
        64: "icons/error_icon64.png"
    }
};
var IconType;
(function (IconType) {
    IconType[IconType["normal"] = 0] = "normal";
    IconType[IconType["disabled"] = 1] = "disabled";
    IconType[IconType["error"] = 2] = "error";
})(IconType || (IconType = {}));
class IconUpdater {
    chooseIcon(type) {
        switch (type) {
            case IconType.normal:
                return normalIcon;
            case IconType.disabled:
                return disabledIcon;
            case IconType.error:
                return errorIcon;
        }
    }
    setIcon(newIconType) {
        if (maybe_some(this.pendingIconType)) {
            this.pendingIconType = newIconType;
        }
        else if (newIconType !== this.currentIconType) {
            this.updateIcon(newIconType);
        }
    }
    updateIcon(newIconType) {
        this.pendingIconType = newIconType;
        const newIcon = this.chooseIcon(newIconType);
        actionAPI.setIcon(newIcon, () => {
            this.currentIconType = newIconType;
            if (maybe_none(this.pendingIconType)) {
                logError("updateIcon callback: unexpected undefined pendingIconType");
            }
            else if (this.pendingIconType === this.currentIconType) {
                this.pendingIconType = undefined;
            }
            else {
                this.updateIcon(this.pendingIconType);
            }
        });
    }
}

;// CONCATENATED MODULE: ../lib/common/i18n.ts


var I18nMessages;
(function (I18nMessages) {
    I18nMessages["name"] = "extName";
    I18nMessages["blockedLinkPageTitle"] = "blockedLinkPageTitle";
    I18nMessages["blockedLinkPageOpenedSecureExplanation"] = "blockedLinkPageOpenedSecureExplanation";
    I18nMessages["blockedPDFPageTitle"] = "blockedPDFPageTitle";
    I18nMessages["blockedPDFPageOpenedSecureExplanation"] = "blockedPDFPageOpenedSecureExplanation";
    I18nMessages["blockedPageHelpLink"] = "blockedPageHelpLink";
    I18nMessages["blockedPageWarningTooltip"] = "blockedPageWarningTooltip";
    I18nMessages["blockedPageUntrustedTooltip"] = "blockedPageUntrustedTooltip";
    I18nMessages["blockedPageBrowserExplanation"] = "blockedPageSecureBrowserExplanation";
    I18nMessages["launchedLinkPageOpenedSecureExplanation"] = "launchedLinkPageOpenedSecureExplanation";
    I18nMessages["launchedPDFPageOpenedSecureExplanation"] = "launchedPDFPageOpenedSecureExplanation";
    I18nMessages["launchedPageGoBack"] = "launchedPageGoBack";
    I18nMessages["launchedPageCloseTab"] = "launchedPageCloseTab";
    I18nMessages["trustUrlButton"] = "blockedPageContinue";
    I18nMessages["untrustUrlButton"] = "blockedPageSecure";
    I18nMessages["rememberTrustDecisionText"] = "blockedPageRemember";
    I18nMessages["openLinkInSecureBrowser"] = "contextMenuOpenSecure";
    I18nMessages["popupNoError"] = "popupNoError";
    I18nMessages["popupGenericError"] = "popupGenericError";
    I18nMessages["popupMissingHelper"] = "popupMissingHelper";
    I18nMessages["popupSureClickInitRequired"] = "popupSureClickInitRequired";
    I18nMessages["popupDisabled"] = "popupDisabled";
    I18nMessages["popupSureClickUnlicensed"] = "popupSureClickUnlicensed";
    I18nMessages["popupSureClickUnconfigured"] = "popupSureClickUnconfigured";
    I18nMessages["popupSecureBrowserWindowButton"] = "popupSecureBrowserWindowButton";
    I18nMessages["popupClearRememberedDecisionsText"] = "popupClearRememberedDecisionsText";
    I18nMessages["popupClearRememberedDecisionsButton"] = "popupClearRememberedDecisionsButton";
    I18nMessages["helpLinkText"] = "popupHelpLinkText";
    I18nMessages["helpLinkLocale"] = "helpLinkLocale";
    I18nMessages["optionsNoOptions"] = "optionsPageNoOptions";
    I18nMessages["optionsLoggingToggle"] = "optionsPageLoggingToggle";
    I18nMessages["ipOverlayBlocked_Title"] = "overlayBlacklist_Title";
    I18nMessages["ipOverlayBlocked_Description"] = "overlayBlacklist_Description";
    I18nMessages["ipOverlayBrandLogo_Description"] = "overlayBlacklistBrand_Description";
    I18nMessages["ipOverlayBlockedDomainAge_Description"] = "overlayBlacklistDomainAge_Description";
    I18nMessages["ipOverlayBlockedFile_Description"] = "overlayBlockedFile_Description";
    I18nMessages["ipOverlayBlockedHttp_Title"] = "overlayHttpBlacklist_Title";
    I18nMessages["ipOverlayBlockedHttp_Description"] = "overlayHttpBlacklist_Description";
    I18nMessages["ipOverlayNormalUnknown_Title"] = "overlayNormalUnknown_Title";
    I18nMessages["ipOverlayNormalUnknown_Description"] = "overlayNormalUnknown_Description";
    I18nMessages["ipOverlayManagedUnknown_Title"] = "overlayManagedUnknown_Title";
    I18nMessages["ipOverlay_BackToSafetyButton"] = "overlay_BackToSafetyButton";
    I18nMessages["ipOverlay_ViewPageLinkButton"] = "overlay_ViewPageLinkButton";
    I18nMessages["ipOverlay_AllowInputButton"] = "overlay_AllowInputButton";
    I18nMessages["ipOverlay_BlameAdmin"] = "overlay_BlameAdmin";
    I18nMessages["ipOptionsAllowedDomainsSectionHeader"] = "optionsAllowedDomainsSectionHeader";
    I18nMessages["ipOptionsAllowedDomainsEmpty"] = "optionsAllowedDomainsEmpty";
    I18nMessages["ufOverlay_Title"] = "ufOverlayTitle";
    I18nMessages["ufStatusMsgOverlay_DescriptionNone"] = "ufStatusMsgOverlayDescriptionNone";
})(I18nMessages || (I18nMessages = {}));
const I18nMessagesWithSub = {
    trustUrlButton: {
        key: "blockedPageContinueV2",
        placeholder: "{THIS_BROWSER}"
    },
    ufOverlay_DescriptionOne: {
        key: "ufOverlayDescriptionOne",
        placeholder: "{CATEGORY}"
    },
    ufOverlay_DescriptionMany: {
        key: "ufOverlayDescriptionMany",
        placeholder: "{LIST_OF_CATEGORIES}"
    },
    daufOverlay_DescriptionDomainAgeDays: {
        key: "daufOverlayDescriptionDomainAgeDays",
        placeholder: "{DOMAIN_AGE_DAYS}"
    },
    ufStatusMsgOverlay_DescriptionOne: {
        key: "ufStatusMsgOverlayDescriptionOne",
        placeholder: "{STATUSMSG}"
    },
    ufStatusMsgOverlay_DescriptionMany: {
        key: "ufStatusMsgOverlayDescriptionMany",
        placeholder: "{LIST_OF_STATUSMSG}"
    },
    ipOverlayProtectedBrandLogo_Description: {
        key: "overlayBlacklistProtectedBrand_Description",
        placeholder: "{BRAND}"
    }
};
function getI18n(i18nMessage, substitution) {
    let key, placeholder;
    if (isString(i18nMessage)) {
        key = i18nMessage;
    }
    else {
        ({ key, placeholder } = i18nMessage);
    }
    let result = chrome.i18n.getMessage(key);
    if (maybe_some(placeholder) && maybe_some(substitution)) {
        result = result.replace(placeholder, substitution);
    }
    return result;
}

;// CONCATENATED MODULE: ./branding.ts






class BrandingManager {
    constructor(configNotifier, errorHandler) {
        this.onPopupDataChanged = new EventDispatcher();
        this.dormantState = { isDormant: false, errorCode: ChragError.recoveredFromError };
        this.disabledBecauseOfSureClickStatus = false;
        this.iconUpdater = new IconUpdater();
        this.isEnterpriseProduct = false;
        this.isVirtualisedBrowser = false;
        this.sureClickStatus = SureClickStatus.Enabled;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        errorHandler.onDormantStateChanged.registerEventHandler(state => this.onDormantStateChanged(state));
    }
    onConfigChanged(config) {
        this.disabledBecauseOfSureClickStatus = config.isExtensionEnabled.disabledBecauseOfSureClickStatus;
        this.isEnterpriseProduct = config.isEnterpriseProduct;
        this.isVirtualisedBrowser = config.isVirtualisedBrowser;
        this.sureClickStatus = config.sureClickStatus;
        this.updateBranding();
    }
    onDormantStateChanged(state) {
        this.dormantState = state;
        this.updateBranding();
    }
    updateBranding() {
        let icon;
        let popupMessage;
        if (!this.dormantState.isDormant) {
            icon = IconType.normal;
            popupMessage = I18nMessages.popupNoError;
        }
        else if (this.dormantState.errorCode === ChragError.notEnabled) {
            if (this.isVirtualisedBrowser && this.sureClickStatus === SureClickStatus.Enabled) {
                icon = IconType.normal;
            }
            else {
                icon = IconType.disabled;
            }
            if (this.isVirtualisedBrowser || this.disabledBecauseOfSureClickStatus) {
                switch (this.sureClickStatus) {
                    case SureClickStatus.Enabled:
                        popupMessage = I18nMessages.popupNoError;
                        break;
                    case SureClickStatus.Disabled:
                        popupMessage = I18nMessages.popupDisabled;
                        break;
                    case SureClickStatus.InitRequired:
                        popupMessage = I18nMessages.popupSureClickInitRequired;
                        break;
                    case SureClickStatus.Unlicensed:
                        popupMessage = this.isEnterpriseProduct ? I18nMessages.popupSureClickUnlicensed
                            : I18nMessages.popupSureClickUnconfigured;
                        break;
                    case SureClickStatus.Unknown:
                        popupMessage = I18nMessages.popupGenericError;
                        break;
                }
            }
            else {
                popupMessage = I18nMessages.popupDisabled;
            }
        }
        else {
            icon = IconType.error;
            switch (this.dormantState.errorCode) {
                case ChragError.helperPortError:
                case ChragError.helperUnresponsive:
                    popupMessage = I18nMessages.popupMissingHelper;
                    break;
                default:
                    popupMessage = I18nMessages.popupGenericError;
                    break;
            }
        }
        this.iconUpdater.setIcon(icon);
        this.onPopupDataChanged.dispatchEvent(popupMessage);
    }
}

;// CONCATENATED MODULE: ./browser-smartscreen-tracker.ts



class BrowserSmartScreenTracker {
    constructor(configNotifier, tabUpdatedNotifier, alertHelper) {
        this.alertHelper = alertHelper;
        this.phishingAlertTitles = new Set([
            "Security error",
            "Reported Unsafe Site: Navigation Blocked",
        ]);
        this.enabled = false;
        this.reportSmartScreen = false;
        tabUpdatedNotifier.registerOnTabUpdatedHandler((tabId, change, tab) => this.onTabUpdated(tabId, change, tab));
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.enabled = true;
            this.reportSmartScreen = config.identityProtection.config.reportSmartScreen;
        }
        else {
            this.enabled = false;
        }
    }
    onTabUpdated(tabId, changeInfo, tab) {
        var _a;
        if (!this.enabled || maybe_none(changeInfo.title) || !this.phishingAlertTitles.has(changeInfo.title)) {
            return;
        }
        const url = (_a = tab.url) !== null && _a !== void 0 ? _a : tab.pendingUrl;
        if (maybe_none(url)) {
            logError("SmartScreen warning detected but no URL was present");
            return;
        }
        log_log(`SmartScreen warning detected: ${url}`);
        if (this.reportSmartScreen) {
            this.alertHelper.sendSmartScreenAlert(tabId, url);
        }
    }
}

;// CONCATENATED MODULE: ./config-cache.ts





;
class CachedValue {
    constructor(key, handshaker) {
        this.key = key;
        this.getValueResolvers = [];
        this.isHandshaken = handshaker.isHandshaken;
        if (!this.isHandshaken) {
            handshaker.onHandshaken.registerEventHandler(_ => this.isHandshaken = true);
        }
    }
    getCachedValue() {
        return new Promise((resolve, reject) => {
            if (maybe_some(this.value)) {
                resolve(this.value);
            }
            else {
                this.getValueResolvers.push(resolve);
            }
        });
    }
    setCachedValue(value) {
        if (this.isHandshaken) {
            this.update(value);
        }
    }
    hasValue() {
        return maybe_some(this.value);
    }
    retrieve() {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(this.key, result => {
                const errorMessage = checkRuntimeLastError();
                if (maybe_some(errorMessage)) {
                    logError(`Cache: Error while retrieving cached config: ${errorMessage}`);
                    this.getValueResolvers = [];
                    reject();
                    return;
                }
                if (this.isHandshaken) {
                    this.getValueResolvers = [];
                    reject();
                    return;
                }
                const retrievedValue = result[this.key];
                if (maybe_some(retrievedValue)) {
                    log_log(`Cache: cached config has been loaded for key ${this.key}: ${string_utils_toString(retrievedValue)}`);
                    this.value = retrievedValue;
                    this.getValueResolvers.forEach(getResolver => getResolver(retrievedValue));
                }
                this.getValueResolvers = [];
                resolve();
            });
        });
    }
    update(value) {
        chrome.storage.local.set({ [this.key]: value }, () => {
            const errorMessage = checkRuntimeLastError();
            if (maybe_some(errorMessage)) {
                logError(`Error updating config cache for key ${this.key} & value ${string_utils_toString(value)}: ${errorMessage}`);
            }
        });
    }
}
class Cache {
    constructor(handshaker, onConfiguredRaiser) {
        this.onConfiguredRaiser = onConfiguredRaiser;
        this.configMessage = new CachedValue(StorageKey.configMessage, handshaker);
        this.reputableSites = new CachedValue(StorageKey.reputableSites, handshaker);
        this.enabledFeatures = new CachedValue(StorageKey.enabledFeatures, handshaker);
        Promise.all([
            this.configMessage.retrieve(),
            this.reputableSites.retrieve(),
            this.enabledFeatures.retrieve()
        ]).then(() => {
            if (this.configMessage.hasValue() && this.enabledFeatures.hasValue()) {
                this.onConfiguredRaiser.onConfigured();
            }
        }).catch(() => {
            log_log("Cache: cached config will not be used because retrieval was unsuccessful");
        });
    }
}

;// CONCATENATED MODULE: ./config-notifier.ts





class ConfigNotifier {
    constructor(onConfigured) {
        this.onConfigured = onConfigured;
        this.keyListeners = new Map();
        this.keyUpdateCompleteListeners = new Map();
        this.config = new Config();
        this.onConfigured.registerListener(() => {
            const uniqueListeners = new Set();
            for (const listeners of this.keyUpdateCompleteListeners.values()) {
                for (const listener of listeners) {
                    uniqueListeners.add(listener);
                }
            }
            for (const listener of uniqueListeners) {
                listener();
            }
        });
    }
    addListener(map, key, listener) {
        const listenersForKey = map.get(key);
        if (maybe_some(listenersForKey)) {
            listenersForKey.push(listener);
        }
        else {
            map.set(key, [listener]);
        }
    }
    addConfigListenerForKey(listener, key) {
        this.addListener(this.keyListeners, key, listener);
        listener(this.config);
    }
    addConfigUpdateCompleteListenerForKeys(listener, keys) {
        for (const key of keys) {
            this.addListener(this.keyUpdateCompleteListeners, key, listener);
        }
    }
    onConfigChanged(config, key) {
        this.config = config;
        const listenersForKey = this.keyListeners.get(key);
        if (maybe_some(listenersForKey)) {
            for (const listener of listenersForKey) {
                try {
                    listener(this.config);
                }
                catch (e) {
                    logError(`Error while applying new "${ConfigKey[key]}" config: ${string_utils_toString(e)}`);
                }
            }
        }
        if (this.onConfigured.isConfigured) {
            const updateCompleteListenersForKey = this.keyUpdateCompleteListeners.get(key);
            if (maybe_some(updateCompleteListenersForKey)) {
                for (const listener of updateCompleteListenersForKey) {
                    try {
                        listener();
                    }
                    catch (e) {
                        logError(`Error while calling update complete for "${ConfigKey[key]}" change: ${string_utils_toString(e)}`);
                    }
                }
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/host/serialized-phishing-source-sites.ts

function isValidSerializedPhishingSourceSites(value) {
    const isValidMethodData = (value) => {
        return maybe_some(value.get) &&
            maybe_some(value.post);
    };
    const isValidNavData = (value) => {
        return maybe_some(value.navigate) &&
            maybe_some(value.redirect) &&
            isValidMethodData(value.navigate) &&
            isValidMethodData(value.redirect);
    };
    const isValidHeuristics = (value) => {
        return maybe_some(value.pageInputEvents) &&
            maybe_some(value.navigationRequestType);
    };
    return value instanceof Object &&
        maybe_some(value.version) &&
        maybe_some(value.phishingSourceSites) &&
        maybe_some(value.webMail) &&
        maybe_some(value.advanced) &&
        maybe_some(value.advanced.requireAuth) &&
        maybe_some(value.advanced.auth) &&
        maybe_some(value.advanced.heuristics) &&
        maybe_some(value.advanced.newTab) &&
        maybe_some(value.advanced.sameTab) &&
        isValidHeuristics(value.advanced.heuristics) &&
        isValidNavData(value.advanced.newTab) &&
        isValidNavData(value.advanced.sameTab);
}

;// CONCATENATED MODULE: ../lib/host/serialized-intranet-sites.ts


function isSerializedIntranetSites(value) {
    return isObject(value) &&
        isArray(value.specs) &&
        isBoolean(value.trustSites) &&
        isBoolean(value.trustNetblocks);
}

;// CONCATENATED MODULE: ../lib/host/identity-protection-config.ts



function isSerializedIPConfigV22(value) {
    return isObject(value) &&
        isArray(value.blockedInputTypes) &&
        isString(value.cloudUrl) &&
        isBoolean(value.onlyOnPageWithPasswordInput) &&
        isArray(value.userAllowedHosts);
}
function isSerializedIPConfigV28(value) {
    return isObject(value) &&
        isArray(value.blockedInputTypes) &&
        isString(value.cloudUrl) &&
        isBoolean(value.onlyOnPageWithPasswordInput) &&
        isArray(value.userAllowedHosts) &&
        isBoolean(value.domainAgeCheckEnabled);
}
function isSerializedIPConfigV33(value) {
    return isObject(value) &&
        isArray(value.blockedInputTypes) &&
        isString(value.cloudUrl) &&
        isBoolean(value.onlyOnPageWithPasswordInput) &&
        isBoolean(value.domainAgeCheckEnabled) &&
        isBoolean(value.treatFileUrlsAsTrusted);
}

;// CONCATENATED MODULE: ./feature-manager.ts





var ResponseTime;
(function (ResponseTime) {
    ResponseTime[ResponseTime["respondImmediately"] = 0] = "respondImmediately";
    ResponseTime[ResponseTime["respondWhenChanged"] = 1] = "respondWhenChanged";
})(ResponseTime || (ResponseTime = {}));
function makeEnabledFeaturesRequestHandler(messageRouter, messageSender) {
    const makeRequest = (id, responseTime) => {
        const respondImmediately = responseTime === ResponseTime.respondImmediately;
        return new EnabledFeaturesRequestV2(id, respondImmediately);
    };
    const readResponse = (response) => {
        const id = response.id;
        const enabledFeatures = {
            linkProtection: response.linkProtection,
            fileURLProtection: response.fileURLProtection,
            pdfProtection: response.pdfProtection,
            downloadProtection: response.downloadProtection
        };
        return [id, enabledFeatures];
    };
    return new RequestResponseHandler(MessageType.enabledFeaturesRequestV2, MessageType.enabledFeaturesResponseV2, makeRequest, readResponse, messageRouter, messageSender);
}
class SBXFeatureManager {
    constructor(configNotifier, errorHandler, canUseBlockingWebRequest, cache) {
        this.canUseBlockingWebRequest = canUseBlockingWebRequest;
        this.cache = cache;
        this.enabledFeatures = {
            linkProtection: false,
            fileURLProtection: false,
            pdfProtection: false,
            downloadProtection: false
        };
        this.isDormant = false;
        this.sbxEnabled = true;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        configNotifier.addConfigListenerForKey(reader => this.onFeaturesChanged(reader), ConfigKey.sbxEnabledFeatures);
        errorHandler.onDormantStateChanged.registerEventHandler(state => this.isDormant = state.isDormant);
        this.cache.enabledFeatures.getCachedValue().then(enabledFeatures => this.enabledFeatures = enabledFeatures);
    }
    static async create(configNotifier, errorHandler, cache) {
        const canUseBlockingWebRequest = await compat.permissions.contains({
            permissions: ['webRequestBlocking']
        });
        const manager = new SBXFeatureManager(configNotifier, errorHandler, canUseBlockingWebRequest, cache);
        return manager;
    }
    isFeatureEnabled(fieldName) {
        if (this.isDormant || !this.sbxEnabled) {
            return false;
        }
        if (fieldName !== "downloadProtection" && !this.canUseBlockingWebRequest) {
            return false;
        }
        return this.enabledFeatures[fieldName];
    }
    get isLinkProtectionEnabled() {
        return this.isFeatureEnabled("linkProtection");
    }
    get isFileURLProtectionEnabled() {
        return this.isFeatureEnabled("fileURLProtection");
    }
    get isPDFProtectionEnabled() {
        return this.isFeatureEnabled("pdfProtection");
    }
    get isDownloadProtectionEnabled() {
        return this.isFeatureEnabled("downloadProtection");
    }
    onConfigChanged(config) {
        this.sbxEnabled = config.sbxEnabled;
    }
    onFeaturesChanged(reader) {
        this.enabledFeatures = reader.sbxEnabledFeatures;
        this.cache.enabledFeatures.setCachedValue(this.enabledFeatures);
    }
}

;// CONCATENATED MODULE: ./config-updater.ts















class ConfigUpdater {
    constructor(configNotifier, messageSender, messageRouter, handshaker, onConfiguredRaiser, cache) {
        this.configNotifier = configNotifier;
        this.messageSender = messageSender;
        this.onConfiguredRaiser = onConfiguredRaiser;
        this.cache = cache;
        this.config = new Config();
        this.sbxEnabledFeaturesHandler = makeEnabledFeaturesRequestHandler(messageRouter, messageSender);
        messageRouter.registerMessageHandler(MessageType.configChangedV1, message => {
            this.onConfigUpdated(message);
            this.onConfiguredRaiser.onConfigured();
        });
        messageRouter.registerManyMessageHandler([MessageType.configChangedV3, MessageType.configChangedV4,
            MessageType.configChangedV5, MessageType.configChangedV7, MessageType.configChangedV8,
            MessageType.configChangedV9, MessageType.configChangedV11, MessageType.configChangedV12,
            MessageType.configChangedV13, MessageType.configChangedV14, MessageType.configChangedV15,
            MessageType.configChangedV17, MessageType.configChangedV19, MessageType.configChangedV20,
            MessageType.configChangedV21, MessageType.configChangedV22, MessageType.configChangedV23,
            MessageType.configChangedV24, MessageType.configChangedV26, MessageType.configChangedV28,
            MessageType.configChangedV29, MessageType.configChangedV33,], message => {
            this.onConfigUpdated(message);
        });
        messageRouter.registerMessagePayloadHandler(MessageType.reputationChangedV3, message => {
            this.onReputationUpdated(message);
        });
        handshaker.onHandshaken.registerEventHandler(event => this.onHandshaken(event));
    }
    onHandshaken(event) {
        this.requestConfigUpdate();
        const protocolVersion = event.negotiatedVersion;
        if (isMessageTypeSupported(MessageType.enabledFeaturesRequestV2, protocolVersion)) {
            this.sbxEnabledFeaturesHandler.sendRequest(ResponseTime.respondImmediately, (responseTime, enabledFeatures) => this.onSBXEnabledFeaturesUpdated(responseTime, enabledFeatures));
        }
        else {
            this.config.sbxEnabledFeatures = {
                linkProtection: true,
                fileURLProtection: true,
                pdfProtection: true,
                downloadProtection: true
            };
            this.configNotifier.onConfigChanged(this.config, ConfigKey.sbxEnabledFeatures);
        }
    }
    requestConfigUpdate() {
        const request = new ConfigRequestV1(StaticConfig.phishingSourceSitesVersion, StaticConfig.phishingNavigationSequencesVersion, getCurrentBrowserInfo());
        this.messageSender.sendMessage(MessageType.configRequestV1, request);
    }
    onConfigUpdated(message) {
        const reputableSites = this.config.reputableSites;
        const sbxEnabledFeatures = this.config.sbxEnabledFeatures;
        this.config = new Config();
        this.config.reputableSites = reputableSites;
        this.config.sbxEnabledFeatures = sbxEnabledFeatures;
        this.setConfig(message.payload);
        this.configNotifier.onConfigChanged(this.config, ConfigKey.config);
        this.cache.configMessage.setCachedValue(message);
    }
    onReputationUpdated(payload) {
        this.config.reputableSites = payload;
        this.configNotifier.onConfigChanged(this.config, ConfigKey.reputableSites);
    }
    onSBXEnabledFeaturesUpdated(responseTime, sbxEnabledFeatures) {
        this.config.sbxEnabledFeatures = sbxEnabledFeatures;
        this.configNotifier.onConfigChanged(this.config, ConfigKey.sbxEnabledFeatures);
        this.onConfiguredRaiser.onConfigured();
        this.sbxEnabledFeaturesHandler.sendRequest(ResponseTime.respondWhenChanged, (responseTime, enabledFeatures) => this.onSBXEnabledFeaturesUpdated(responseTime, enabledFeatures));
    }
    setConfig(configChanged) {
        this.config.isEnabled = parseSerializedIsEnabledData(configChanged.isEnabled);
        const phishingSourceSites = configChanged.phishingSourceSites;
        if (isValidSerializedPhishingSourceSites(phishingSourceSites) &&
            (phishingSourceSites.version === StaticConfig.phishingSourceSitesVersion)) {
            this.config.phishingSourceSites = phishingSourceSites;
        }
        else {
            this.config.phishingSourceSites = undefined;
        }
        const phishingNavigationSequences = configChanged.phishingNavigationSequences;
        if (isSerializedPhishingNavSeqData(phishingNavigationSequences)) {
            this.config.phishingNavigationSequences = phishingNavigationSequences;
        }
        else {
            this.config.phishingNavigationSequences = undefined;
        }
        this.config.trustedUrls = configChanged.trustedSites;
        this.config.untrustedUrls = configChanged.untrustedSites;
        this.config.userTrustedOrigins = configChanged.userTrustedOrigins;
        this.config.userUntrustedOrigins = configChanged.userUntrustedOrigins;
        this.config.openPhishingLinksInSecureBrowser = configChanged.openPhishingLinksInSecureBrowser;
        if ("prioritiseTrustedSites" in configChanged) {
            this.config.prioritiseTrustedSites = configChanged.prioritiseTrustedSites;
        }
        if ("promptForUncategorized" in configChanged) {
            this.config.promptForUncategorized = configChanged.promptForUncategorized;
        }
        if ("isEnterpriseProduct" in configChanged) {
            const isEnterpriseProduct = configChanged.isEnterpriseProduct;
            if (maybe_some(isEnterpriseProduct)) {
                if (isEnterpriseProduct) {
                    this.config.productType = ProductTypes.LegacyEnterprise;
                }
                else {
                    this.config.productType = ProductTypes.LegacyOther;
                }
            }
        }
        if ("newTabPageUrls" in configChanged) {
            const newTabPageUrls = configChanged.newTabPageUrls;
            if (isSerializedNewTabPageUrlsV12(newTabPageUrls)) {
                this.config.newTabPageUrls = newTabPageUrls;
            }
            else if (isSerializedNewTabPageUrlsV7(newTabPageUrls)) {
                this.config.newTabPageUrls = Object.assign(Object.assign({}, newTabPageUrls), { edgeChromium: [] });
            }
        }
        if ("blockedPageLearnMoreURL" in configChanged) {
            const isConsumerProduct = configChanged.isConsumerProduct;
            if (maybe_some(isConsumerProduct)) {
                this.config.isHPConsumerMachine = isConsumerProduct;
            }
            const blockedPageLearnMoreURL = configChanged.blockedPageLearnMoreURL;
            if (!isEmptyString(blockedPageLearnMoreURL)) {
                this.config.blockedPageLearnMoreURL = blockedPageLearnMoreURL;
            }
        }
        if ("productStatus" in configChanged) {
            this.config.secureBrowserRedirectTrustedSites = configChanged.secureBrowserRedirectTrustedSites;
            this.config.sureClickStatus = configChanged.productStatus;
        }
        if ("linkProtectionServiceConsumers" in configChanged) {
            const linkProtectionServiceConsumers = configChanged.linkProtectionServiceConsumers;
            if (maybe_some(linkProtectionServiceConsumers)) {
                if (isSerializedLPSConsumersV15(linkProtectionServiceConsumers)) {
                    this.config.linkProtectionServiceConsumers = linkProtectionServiceConsumers;
                }
                else if (isSerializedLPSConsumersV13(linkProtectionServiceConsumers)) {
                    this.config.linkProtectionServiceConsumers = {
                        chrome: linkProtectionServiceConsumers,
                        firefox: linkProtectionServiceConsumers,
                        edgeChromium: linkProtectionServiceConsumers,
                        secureBrowser: linkProtectionServiceConsumers,
                        sbxSecureBrowserMode: this.config.sbxSecureBrowserMode
                    };
                }
            }
        }
        if ("closeLaunchedPageTabs" in configChanged) {
            this.config.closeLaunchedPageTabs = configChanged.closeLaunchedPageTabs;
        }
        if ("productType" in configChanged) {
            this.config.isHPConsumerMachine = configChanged.isHPConsumerMachine;
            this.config.productType = this.validateProductType(configChanged.productType);
        }
        if ("intranetSites" in configChanged) {
            const intranetSites = configChanged.intranetSites;
            if (isSerializedIntranetSites(intranetSites)) {
                this.config.intranetSites = intranetSites;
            }
            else {
                this.config.intranetSites = undefined;
            }
        }
        if ("identityProtection" in configChanged) {
            const ipConfig = configChanged.identityProtection;
            if (isSerializedIPConfigV33(ipConfig)) {
                this.config.setIdentityProtection(ipConfig);
            }
            else if (isSerializedIPConfigV28(ipConfig)) {
                this.config.setIdentityProtection(Object.assign(Object.assign({}, ipConfig), { treatFileUrlsAsTrusted: false }));
            }
            else if (isSerializedIPConfigV22(ipConfig)) {
                this.config.setIdentityProtection(Object.assign(Object.assign({}, ipConfig), { domainAgeCheckEnabled: false, domainAgeCheckMinDays: 30, treatFileUrlsAsTrusted: false }));
            }
            else {
                this.config.setIdentityProtection(undefined);
            }
        }
        if ("ipIsSureClick" in configChanged) {
            this.config.ipIsIndependentOfSureClick = !configChanged.ipIsSureClick;
        }
        if ("ufBlockedCategories" in configChanged) {
            this.config.ufBlockedCategories = configChanged.ufBlockedCategories;
        }
        if ("ufDomainAgeCheckEnabled" in configChanged) {
            this.config.ufDomainAgeCheckEnabled = configChanged.ufDomainAgeCheckEnabled;
        }
        if ("ufDomainAgeCheckMinDays" in configChanged) {
            this.config.ufDomainAgeCheckMinDays = configChanged.ufDomainAgeCheckMinDays;
        }
        if ("ufStatusCodeCheckEnabled" in configChanged) {
            this.config.ufStatusCodeCheckEnabled = configChanged.ufStatusCodeCheckEnabled;
        }
    }
    validateProductType(productType) {
        const minProductType = ProductTypes.Unknown;
        const maxProductType = ProductTypes.Foundation;
        if (isInRange(productType, minProductType, maxProductType)) {
            return productType;
        }
        else {
            logError(`ConfigUpdaterV19: Unknown product type sent by helper: ${productType}`);
            return ProductTypes.Unknown;
        }
    }
}

;// CONCATENATED MODULE: ../lib/common/port-resolver.ts



class PortResolver {
    constructor(portName, onUnresolvedPortConnected) {
        this.portName = portName;
        this.onUnresolvedPortConnected = onUnresolvedPortConnected;
        this.resolver = undefined;
        chrome.runtime.onConnect.addListener(this.onPortConnected.bind(this));
    }
    onPortConnected(port) {
        if (!compareStrings(port.name, this.portName)) {
            return;
        }
        if (maybe_none(this.resolver)) {
            this.onUnresolvedPortConnected(port);
            return;
        }
        this.resolver(port);
        this.resolver = undefined;
    }
    resolvePort() {
        return makePromiseAsync((resolve) => {
            this.resolver = resolve;
        });
    }
}

;// CONCATENATED MODULE: ../lib/common/common-types.ts
const TopLevelFrameId = 0;

;// CONCATENATED MODULE: ./tab-snapper.ts

const screenshotDelay = 250;
class TabSnapper {
    constructor(tabId) {
        this.tabId = tabId;
        this.waitingForActive = false;
    }
    takeScreenshot(callback) {
        this.clearPendingSnap();
        this.snapCallback = callback;
        this.snapTimeout = setTimeout(() => {
            this.snapTimeout = undefined;
            this.snap();
        }, screenshotDelay);
    }
    maybeTakeDelayedScreenshot() {
        if (this.waitingForActive) {
            this.clearPendingSnap();
            this.snap();
        }
    }
    freezeScreenshot() {
        this.secureScreenshotData = this.screenshotData;
    }
    clearScreenshot() {
        this.clearPendingSnap();
        this.screenshotData = undefined;
    }
    get secureScreenshot() {
        if (maybe_some(this.secureScreenshotData)) {
            return this.secureScreenshotData;
        }
        else {
            return this.screenshotData;
        }
    }
    get screenshot() {
        return this.screenshotData;
    }
    clearPendingSnap() {
        if (maybe_some(this.snapTimeout)) {
            clearTimeout(this.snapTimeout);
            this.snapTimeout = undefined;
            this.snapCallback = undefined;
        }
    }
    snap() {
        chrome.tabs.get(this.tabId, tab => {
            this.waitingForActive = false;
            if (tab.active) {
                chrome.tabs.captureVisibleTab(tab.windowId, screenshotData => {
                    this.screenshotData = screenshotData;
                    if (maybe_some(this.snapCallback)) {
                        this.snapCallback(true);
                        this.snapCallback = undefined;
                    }
                });
            }
            else {
                this.waitingForActive = true;
            }
        });
    }
}

;// CONCATENATED MODULE: ../lib/common/content-script-common.ts
var OverlayAction;
(function (OverlayAction) {
    OverlayAction[OverlayAction["OverlayNotShown"] = 0] = "OverlayNotShown";
    OverlayAction[OverlayAction["BackToSafety"] = 1] = "BackToSafety";
    OverlayAction[OverlayAction["CloseTab"] = 2] = "CloseTab";
    OverlayAction[OverlayAction["ViewWithInputDisabled"] = 3] = "ViewWithInputDisabled";
    OverlayAction[OverlayAction["EnableInput"] = 4] = "EnableInput";
})(OverlayAction || (OverlayAction = {}));

;// CONCATENATED MODULE: ./content-script-controller.ts




















const contentScriptSentMessageTypes = [
    MessageType.phishingDetectionTrippedV22,
    MessageType.phishingDetectionSuppressedV22,
    MessageType.phishingInformationSubmittedV22,
    MessageType.onFrameDomUpdateV22,
    MessageType.freezeScreenshotV22,
    MessageType.onOverlayClickV22,
    MessageType.analyseWebsiteScreenshotOpportunityEventV31,
];
var ScreenshotAnalysisState;
(function (ScreenshotAnalysisState) {
    ScreenshotAnalysisState[ScreenshotAnalysisState["unknown"] = 0] = "unknown";
    ScreenshotAnalysisState[ScreenshotAnalysisState["inProgress"] = 1] = "inProgress";
    ScreenshotAnalysisState[ScreenshotAnalysisState["retriesExceeded"] = 2] = "retriesExceeded";
    ScreenshotAnalysisState[ScreenshotAnalysisState["unknownLogoFound"] = 3] = "unknownLogoFound";
    ScreenshotAnalysisState[ScreenshotAnalysisState["knownLogoFound"] = 4] = "knownLogoFound";
})(ScreenshotAnalysisState || (ScreenshotAnalysisState = {}));
;
class ContentScriptFrameController {
    constructor(tabId, frameId, port, onDisconnect, onMessage, onConfigured, hostHelperMessageSender) {
        this.tabId = tabId;
        this.frameId = frameId;
        this.onDisconnect = onDisconnect;
        this.onMessage = onMessage;
        this.sendMessage = (type, payload) => {
            if (this.sentFrameLoadResponse) {
                this.pagePortController.sendMessage(type, payload);
            }
            else if (type === MessageType.frameLoadResponseV22) {
                this.pagePortController.sendMessage(type, payload);
                this.sentFrameLoadResponse = true;
            }
            else if (type !== MessageType.contentScriptDataV22) {
                logError(`Unexpectedly tried to send message before the frame load response: ${MessageType[type]}`);
            }
        };
        this.hasInterestingInput = false;
        this.sentFrameLoadResponse = false;
        this.pagePortController = new PagePortController(tabId, port, undefined, port => this.onFrameDisconnnected(port), hostHelperMessageSender, onConfigured);
        this.pagePortController.registerManyMessageHandler(contentScriptSentMessageTypes, message => this.onMessage(this, message));
        this.pagePortController.connect();
    }
    onFrameDisconnnected(port) {
        this.onDisconnect(this);
    }
}
class ContentScriptTabController {
    constructor(tabId, protocolVersion, ipEnabled, aiBrandLogoProtectionEnabled, identityProtectionConfig, categoryTracker, onConfigured, hostHelperMessageSender, alertHelper, badgeManager, urlFilterer, analyseWebsiteScreenshotRequestHandler) {
        this.tabId = tabId;
        this.protocolVersion = protocolVersion;
        this.ipEnabled = ipEnabled;
        this.aiBrandLogoProtectionEnabled = aiBrandLogoProtectionEnabled;
        this.categoryTracker = categoryTracker;
        this.onConfigured = onConfigured;
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.alertHelper = alertHelper;
        this.badgeManager = badgeManager;
        this.urlFilterer = urlFilterer;
        this.analyseWebsiteScreenshotRequestHandler = analyseWebsiteScreenshotRequestHandler;
        this.ipContentScriptConfig = {
            operationMode: IPOperationMode.BlockedOnly,
            onlyOnPageWithPasswordInput: false,
            onlyTriggerOnPasswordInput: false,
            trustPagesWithAutofilledPasswords: false,
            useLinkAnalysisHeuristic: false,
            treatHttpPagesAsBlocked: false,
            treatFileUrlsAsBlocked: false,
            allowUserToEnableInput: false,
            blockedElementTags: [],
            blockedInputElementTypes: [],
            treatFileUrlsAsTrusted: false,
        };
        this.takeScreenshot = false;
        this.frameControllers = new Set();
        this.state = new ContentScriptTabController.State(this.tabId);
        this.updateIPConfig(identityProtectionConfig);
    }
    addFrameController(frameId, port) {
        const isTopLevelFrame = frameId === TopLevelFrameId;
        if (isTopLevelFrame) {
            if (maybe_some(this.url)) {
                log_log(`A new top level frame connected in tab ${this.tabId} but the old one has not disconnected`);
                for (const oldTopFC of Array.from(this.frameControllers).filter(c => c.frameId === TopLevelFrameId)) {
                    this.frameControllers.delete(oldTopFC);
                }
                this.onTopLevelFrameDisconnected();
            }
            this.url = readPortPageUrl(port);
            if (maybe_none(this.url)) {
                logError("ContentScriptTabController: port page URL is not defined");
            }
        }
        const frameController = new ContentScriptFrameController(this.tabId, frameId, makePromise(() => port), controller => this.onFrameDisconnected(controller), (controller, message) => this.onFrameMessage(controller, message), this.onConfigured, this.hostHelperMessageSender);
        frameController.sendMessage(MessageType.frameLoadResponseV22, new FrameLoadResponseV22(frameId, this.linkProtectionWouldBlock, this.ipEnabled, this.ipContentScriptConfig));
        this.frameControllers.add(frameController);
        if (isTopLevelFrame && maybe_some(this.url)) {
            const urlSpec = this.url.toString();
            this.urlFilterer.shouldBlock(urlSpec).then(([{ categoryblock, statusblock, blockingCategories, statusCode, statusMsg, overridden }, domainAgeResults]) => {
                this.state.statusCode = statusCode;
                this.state.statusMsg = statusMsg;
                this.state.domainAgeDays = domainAgeResults.domainAgeDays;
                this.state.domainAgeDaysThreshold = domainAgeResults.thresholdDays;
                if (statusblock) {
                    log_log(`Showing Status Code URL Filtering blocking overlay on tab ${this.tabId} with url ${this.url}`);
                    frameController.sendMessage(MessageType.showStatusMsgUrlFilteringOverlayV29, { statusMsg });
                    this.alertHelper.sendUrlFilteringAlert(this.tabId, urlSpec, blockingCategories, statusCode, statusMsg, overridden, domainAgeResults.domainAgeDays, domainAgeResults.thresholdDays, IPReportType.StatusCodeURLFilteringExtension);
                }
                else if (categoryblock) {
                    log_log(`Showing Category URL Filtering blocking overlay on tab ${this.tabId} with url ${this.url}`);
                    frameController.sendMessage(MessageType.showUrlFilteringOverlayV26, { blockingCategories });
                    this.alertHelper.sendUrlFilteringAlert(this.tabId, urlSpec, blockingCategories, statusCode, statusMsg, overridden, domainAgeResults.domainAgeDays, domainAgeResults.thresholdDays, IPReportType.URLFilteringExtension);
                }
                else if (domainAgeResults.block) {
                    if (domainAgeResults.domainAgeDays) {
                        log_log(`Showing URL Filtering domain age overlay on tab ${this.tabId} with url ${this.url}`);
                        const domainAgeDays = domainAgeResults.domainAgeDays;
                        frameController.sendMessage(MessageType.showDomainAgeUrlFilteringOverlayV28, { domainAgeDays });
                        this.alertHelper.sendUrlFilteringAlert(this.tabId, urlSpec, blockingCategories, statusCode, statusMsg, overridden, domainAgeResults.domainAgeDays, domainAgeResults.thresholdDays, IPReportType.DomainAgeURLFilteringExtension);
                    }
                    else {
                        logError(`Domain age block result without required data on tab ${this.tabId} with url ${this.url} `);
                    }
                }
            });
        }
    }
    shouldAnalyseScreenshot(important) {
        if (!isMessageTypeSupported(MessageType.analyseWebsiteScreenshotRequestV31, this.protocolVersion)) {
            log_log("Screenshot analysis skipped as protocol version does not support it");
            return false;
        }
        if (!this.aiBrandLogoProtectionEnabled) {
            log_log("Screenshot analysis skipped as it's not enabled");
            return false;
        }
        if (this.tripped) {
            log_log("Screenshot analysis skipped as protections was already triggered");
            return false;
        }
        const { state } = this.screenshotAnalysisData;
        if (state === ScreenshotAnalysisState.unknown) {
            log_log("Screenshot analysis allowed as state is unknown");
            return true;
        }
        if (state === ScreenshotAnalysisState.retriesExceeded && important) {
            log_log("Screenshot analysis allowed as analysis is important (state is retries exceeded)");
            return true;
        }
        if (state === ScreenshotAnalysisState.unknownLogoFound && important) {
            log_log("Screenshot analysis allowed as analysis is important (state is unknown logo found)");
            return true;
        }
        log_log(`Screenshot analysis skipped, state=${state}`);
        return false;
    }
    requestScreenshotAnalysis(important) {
        if (this.shouldAnalyseScreenshot(important)) {
            if (this.category === undefined || this.category === IPPageCategory.Unknown) {
                let screenshotBase64 = this.tabSnapper.screenshot;
                if (maybe_none(screenshotBase64)) {
                    logError("Failed to scan page because there is no screenshot");
                }
                else if (maybe_none(this.url)) {
                    logError("Failed to scan page because there is no URL");
                }
                else {
                    const screenshotAnalysisData = this.screenshotAnalysisData;
                    if (screenshotBase64 !== screenshotAnalysisData.screenshotBase64) {
                        log_log(`Performing screenshot analysis on tab ${this.tabId} with url ${this.url}`);
                        this.screenshotAnalysisData = Object.assign(Object.assign({}, screenshotAnalysisData), { state: ScreenshotAnalysisState.inProgress, screenshotBase64: screenshotBase64 });
                        this.analyseWebsiteScreenshotRequestHandler.sendRequest({ url: this.url.href, screenshotBase64 }, (requestData, resultData) => this.onScreenshotAnalysisResponse(resultData));
                    }
                    else {
                        log_log("Skipping screenshot analysis due to previous matching request");
                    }
                }
            }
            else {
                log_log(`Screenshot analysis skipped for tab ${this.tabId} with url ${this.url} as the category is ${this.category}`);
            }
        }
    }
    onScreenshotAnalysisResponse(resultData) {
        var _a;
        const { result, url, identifiedBrandLogos, } = resultData;
        if (((_a = this.url) === null || _a === void 0 ? void 0 : _a.href) === url && result !== LogoAnalysisResultTypes.Failure) {
            logObject('ContentScriptTabController: got screenshot analysis result', resultData);
            const { attempts } = this.screenshotAnalysisData;
            const calculateNewState = () => {
                switch (result) {
                    case LogoAnalysisResultTypes.UnknownLogoFound:
                        return ScreenshotAnalysisState.unknownLogoFound;
                    case LogoAnalysisResultTypes.KnownLogoFound:
                        return ScreenshotAnalysisState.knownLogoFound;
                    default:
                        if (attempts > 5) {
                            return ScreenshotAnalysisState.retriesExceeded;
                        }
                        else {
                            return ScreenshotAnalysisState.unknown;
                        }
                }
            };
            const logoFound = result !== LogoAnalysisResultTypes.NoLogoFound;
            const protectedLogoFound = result === LogoAnalysisResultTypes.KnownLogoFound;
            let protectedBrandLogo = undefined;
            if (protectedLogoFound && identifiedBrandLogos.length > 0) {
                protectedBrandLogo = identifiedBrandLogos[0];
            }
            const logoAnalysis = new OnLogoAnalysisCompleteV31(logoFound, protectedLogoFound, protectedBrandLogo);
            this.screenshotAnalysisData = Object.assign(Object.assign({}, this.screenshotAnalysisData), { state: calculateNewState(), attempts: attempts + 1, logoAnalysis });
            for (const frameController of this.frameControllers) {
                frameController.sendMessage(MessageType.onLogoAnalysisCompleteV31, logoAnalysis);
            }
            if (shouldMakePhishingReport(this.category, this.operationMode, this.linkProtectionWouldBlock) &&
                (this.category === IPPageCategory.Unknown) &&
                protectedLogoFound) {
                this.preparePhishingReport();
            }
        }
        else {
            log_log(`ContentScriptTabController: will ignore screenshot analysis result, ${resultData}`);
        }
    }
    onChange(protocolVersion, ipEnabled, identityProtectionConfig, aiBrandLogoProtectionEnabled) {
        this.protocolVersion = protocolVersion;
        this.ipEnabled = ipEnabled;
        this.aiBrandLogoProtectionEnabled = aiBrandLogoProtectionEnabled;
        this.updateIPConfig(identityProtectionConfig);
        this.onDataUpdated();
    }
    onActivated() {
        this.tabSnapper.maybeTakeDelayedScreenshot();
    }
    setLinkProtectionWouldBlock(payload) {
        log_log(`ContentScriptTabController: link protection would block event for tab ${this.tabId}`);
        this.linkProtectionBlockEvent = payload;
        this.onDataUpdated();
    }
    clearLinkProtectionWouldBlock() {
        if (maybe_some(this.linkProtectionBlockEvent)) {
            log_log(`ContentScriptTabController: link protection would block event cleared for tab ${this.tabId}`);
            this.linkProtectionBlockEvent = undefined;
            this.onDataUpdated();
        }
    }
    onDataUpdated() {
        this.sendMessageToAllFrames(MessageType.contentScriptDataV22, new ContentScriptDataV22(this.linkProtectionWouldBlock, this.ipEnabled, this.ipContentScriptConfig));
    }
    onFrameDisconnected(controller) {
        if (!this.frameControllers.delete(controller)) {
            return;
        }
        if (controller.frameId === TopLevelFrameId) {
            this.onTopLevelFrameDisconnected();
            return;
        }
        if (controller.hasInterestingInput && !this.pageHasInterestingInput()) {
            log_log(`Tab ${this.tabId} no longer has interesting input`);
            this.badgeManager.resetTabBadge(this.tabId);
        }
    }
    onTopLevelFrameDisconnected() {
        if (this.reportCreated) {
            this.alertHelper.sendPreparedPhishingAlert(this.tabId);
        }
        this.resetState();
    }
    onFrameMessage(controller, message) {
        var _a;
        switch (message.type) {
            case MessageType.phishingDetectionTrippedV22:
                log_log(`Detection tripped by frame ${controller.frameId} for tab ${this.tabId}`);
                this.sendMessageToAllFrames(message);
                this.tripped = true;
                if (shouldMakePhishingReport(this.category, this.operationMode, this.linkProtectionWouldBlock)) {
                    this.preparePhishingReport();
                    if (this.category === IPPageCategory.Blocked) {
                        this.addPhishingReportAction(IPReportActions.BlockedByBlocklist);
                    }
                }
                break;
            case MessageType.phishingDetectionSuppressedV22:
                log_log(`Detection suppressed by frame ${controller.frameId} for tab ${this.tabId}`);
                this.sendMessageToAllFrames(message);
                this.badgeManager.setTabBadge(this.tabId, Colour.green);
                this.suppressed = true;
                this.tabSnapper.clearScreenshot();
                break;
            case MessageType.phishingInformationSubmittedV22:
                log_log(`ContentScriptTabController: phishing information submitted for for tab ${this.tabId}`);
                this.addPhishingReportAction(IPReportActions.FormSubmitted);
                break;
            case MessageType.onFrameDomUpdateV22:
                const frameInfo = message.payload;
                controller.hasInterestingInput = frameInfo.hasInterestingInput;
                const pageHasInterestingInput = this.pageHasInterestingInput();
                if (maybe_none(this.category) && pageHasInterestingInput) {
                    if (maybe_some(this.url)) {
                        log_log(`ContentScriptTabController: Interesting input detected for tab ${this.tabId}`);
                        const urlSpec = this.url.href;
                        this.categoryTracker.categorise(this.url, details => this.onCategorised(details, urlSpec));
                    }
                    else {
                        logError("ContentScriptTabController: URL is not defined");
                    }
                }
                else if (maybe_some(this.category) && !frameInfo.hasCategory) {
                    controller.sendMessage(MessageType.onPhishingCategoryChangedV22, { category: this.category, canonicalBlockingSource: (_a = this.categoryDetails) === null || _a === void 0 ? void 0 : _a.list });
                }
                if (pageHasInterestingInput && !this.tripped && !this.suppressed) {
                    this.tabSnapper.takeScreenshot(success => {
                        if (success) {
                            this.requestScreenshotAnalysis(false);
                        }
                    });
                }
                else if (!this.tripped) {
                    this.tabSnapper.clearScreenshot();
                }
                break;
            case MessageType.freezeScreenshotV22:
                log_log(`ContentScriptTabController: freezing screenshot for tab ${this.tabId}`);
                this.tabSnapper.freezeScreenshot();
                break;
            case MessageType.onOverlayClickV22:
                this.onOverlayClick(message.payload);
                break;
            case MessageType.analyseWebsiteScreenshotOpportunityEventV31:
                const info = message.payload;
                this.requestScreenshotAnalysis(info.important);
                break;
        }
    }
    onOverlayClick(message) {
        log_log(`ContentScriptTabController: overlay action ${OverlayAction[message.action]} for tab ${this.tabId}`);
        switch (message.action) {
            case OverlayAction.OverlayNotShown:
                this.addPhishingReportAction(IPReportActions.LearningModeBypass);
                break;
            case OverlayAction.BackToSafety:
                this.replaceTab();
                break;
            case OverlayAction.ViewWithInputDisabled:
                break;
            case OverlayAction.EnableInput:
                if (isInputAllowableOpMode(this.operationMode) && this.ipContentScriptConfig.allowUserToEnableInput) {
                    this.addPhishingReportAction(IPReportActions.InputAllowed);
                    this.sendMessageToAllFrames(MessageType.onOverlayClickV22, message);
                    this.badgeManager.setTabBadge(this.tabId, Colour.green);
                    if (this.category !== IPPageCategory.Blocked) {
                        if (maybe_some(this.url)) {
                            this.categoryTracker.userAllowHostnames([this.url]);
                        }
                        else {
                            logError("ContentScriptTabController: Failed to allow input because of undefined URL");
                        }
                    }
                }
                else {
                    logError("Invalid attempt to allow input");
                }
                break;
        }
    }
    replaceTab() {
        chrome.tabs.get(this.tabId, currentTab => {
            const newTabInfo = {
                windowId: currentTab.windowId,
                index: currentTab.index,
                active: true
            };
            chrome.tabs.create(newTabInfo, newTab => chrome.tabs.remove(this.tabId));
        });
    }
    onCategorised(details, urlSpec) {
        var _a;
        if (maybe_some(details.domainAgeDays)) {
            this.state.domainAgeDays = details.domainAgeDays;
            this.state.domainAgeDaysThreshold = details.domainAgeDaysThreshold;
        }
        if (((_a = this.url) === null || _a === void 0 ? void 0 : _a.href) === urlSpec && !details.equals(this.categoryDetails)) {
            this.categoryDetails = details;
            this.sendMessageToAllFrames(MessageType.onPhishingCategoryChangedV22, { category: details.category, canonicalBlockingSource: details.list });
            if (!this.suppressed && !this.tripped) {
                if (!this.pageHasInterestingInput()) {
                    this.badgeManager.resetTabBadge(this.tabId);
                }
                else if (shouldDisableInput(details.category, this.operationMode, this.linkProtectionWouldBlock)) {
                    if (details.category === IPPageCategory.Blocked) {
                        this.badgeManager.setTabBadge(this.tabId, Colour.red);
                    }
                    else {
                        this.badgeManager.setTabBadge(this.tabId, Colour.orange);
                    }
                }
                else {
                    this.badgeManager.setTabBadge(this.tabId, Colour.green);
                }
            }
        }
    }
    sendMessageToAllFrames(messageOrType, maybePayload) {
        let type;
        let payload;
        if (isNumber(messageOrType)) {
            type = messageOrType;
            payload = maybePayload;
        }
        else {
            type = messageOrType.type;
            payload = messageOrType.payload;
        }
        for (const controller of this.frameControllers) {
            controller.sendMessage(type, payload);
        }
    }
    preparePhishingReport() {
        if (maybe_none(this.url) || maybe_none(this.categoryDetails)) {
            logError("Failed to prepare a phishing report because of a missing url");
            return;
        }
        const urlSpec = URLToString(this.url);
        let screenshot;
        if (this.takeScreenshot) {
            screenshot = this.tabSnapper.secureScreenshot;
            if (maybe_none(screenshot)) {
                logError("Failed to prepare a phishing report because there is no screenshot");
                return;
            }
        }
        const calculateReportType = () => {
            var _a;
            if (((_a = this.categoryDetails) === null || _a === void 0 ? void 0 : _a.list) === IPSortingList.DomainAge) {
                return IPReportType.DomainAgeExtension;
            }
            if (this.didFindProtectedLogo) {
                return IPReportType.AIBrandLogoProtectionExtension;
            }
            return IPReportType.CrendentialExtension;
        };
        const reportType = calculateReportType();
        if (this.alertHelper.prepareCredentialPhishingAlert(this.tabId, reportType, urlSpec, this.categoryDetails, screenshot, this.state.statusCode, this.state.statusMsg, this.state.domainAgeDays, this.state.domainAgeDaysThreshold, this.linkProtectionBlockEvent, this.screenshotAnalysisData.logoAnalysis)) {
            this.reportCreated = true;
        }
    }
    addPhishingReportAction(action) {
        if (this.reportCreated) {
            const tabId = this.tabId;
            log_log(`Phishing report action ${IPReportActions[action]} added for tab ${tabId}`);
            this.hostHelperMessageSender.sendMessage(MessageType.addPhishingReportActionV22, { tabId, action });
        }
    }
    updateIPConfig(config) {
        if (maybe_none(config)) {
            return;
        }
        this.ipContentScriptConfig = {
            operationMode: config.operationMode,
            onlyOnPageWithPasswordInput: config.onlyOnPageWithPasswordInput,
            onlyTriggerOnPasswordInput: config.onlyTriggerOnPasswordInput,
            trustPagesWithAutofilledPasswords: config.trustPagesWithAutofilledPasswords,
            useLinkAnalysisHeuristic: config.useLinkAnalysisHeuristic,
            treatHttpPagesAsBlocked: config.treatHttpAsBlocked,
            treatFileUrlsAsBlocked: config.treatFileAsBlocked,
            allowUserToEnableInput: config.allowUserToEnableInput,
            blockedElementTags: config.blockedTags,
            blockedInputElementTypes: config.blockedInputTypes,
            treatFileUrlsAsTrusted: config.treatFileUrlsAsTrusted,
        };
        this.takeScreenshot = config.takeScreenshot;
    }
    get operationMode() {
        return this.ipContentScriptConfig.operationMode;
    }
    get category() {
        var _a;
        return (_a = this.categoryDetails) === null || _a === void 0 ? void 0 : _a.category;
    }
    get linkProtectionWouldBlock() {
        return maybe_some(this.linkProtectionBlockEvent);
    }
    pageHasInterestingInput() {
        return Array.from(this.frameControllers).some(c => c.hasInterestingInput);
    }
    get categoryDetails() { return this.state.categoryDetails; }
    set categoryDetails(value) { this.state.categoryDetails = value; }
    get reportCreated() { return this.state.reportCreated; }
    set reportCreated(value) { this.state.reportCreated = value; }
    ;
    get suppressed() { return this.state.suppressed; }
    set suppressed(value) { this.state.suppressed = value; }
    ;
    get tabSnapper() { return this.state.tabSnapper; }
    get tripped() { return this.state.tripped; }
    set tripped(value) { this.state.tripped = value; }
    get screenshotAnalysisData() { return this.state.screenshotAnalysisData; }
    set screenshotAnalysisData(value) { this.state.screenshotAnalysisData = value; }
    get url() { return this.state.url; }
    set url(value) { this.state.url = value; }
    get didFindProtectedLogo() {
        var _a, _b;
        const protectedLogoFound = (_b = (_a = this.state.screenshotAnalysisData.logoAnalysis) === null || _a === void 0 ? void 0 : _a.protectedLogoFound) !== null && _b !== void 0 ? _b : false;
        return (this.category === IPPageCategory.Unknown && protectedLogoFound);
    }
    resetState() {
        this.state = new ContentScriptTabController.State(this.tabId);
        this.badgeManager.resetTabBadge(this.tabId);
    }
}
ContentScriptTabController.State = class {
    constructor(tabId) {
        this.reportCreated = false;
        this.suppressed = false;
        this.tripped = false;
        this.screenshotAnalysisData = {
            state: ScreenshotAnalysisState.unknown,
            attempts: 0,
        };
        this.tabSnapper = new TabSnapper(tabId);
    }
    ;
};
class ContentScriptController {
    constructor(configNotifier, errorHandler, navigationNotifier, handshaker, linkProtectionService, tabNotifier, categoryTracker, onConfigured, hostHelperMessageRouter, hostHelperMessageSender, alertHelper, badgeManager, urlFilterer) {
        this.categoryTracker = categoryTracker;
        this.onConfigured = onConfigured;
        this.hostHelperMessageRouter = hostHelperMessageRouter;
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.alertHelper = alertHelper;
        this.badgeManager = badgeManager;
        this.urlFilterer = urlFilterer;
        this.isDormant = false;
        this.identityProtectionEnabled = false;
        this.aiBrandLogoProtectionEnabled = false;
        this.pendingLinkProtectionEventPayloads = new Map();
        this.tabControllers = new Map();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        errorHandler.onDormantStateChanged.registerEventHandler(state => {
            this.isDormant = state.isDormant;
            this.onChange();
        });
        navigationNotifier.registerOnNavigationHandler((tabId, isFreshNavSeq) => this.onNavigation(tabId, isFreshNavSeq));
        handshaker.onHandshaken.registerEventHandler(event => {
            this.protocolVersion = event.negotiatedVersion;
            this.onChange();
        });
        linkProtectionService.onEvent.registerEventHandler(event => this.onLinkProtectionWouldBlock(event));
        tabNotifier.registerOnTabActivatedHandler(tabId => this.onTabActivated(tabId));
        tabNotifier.registerOnTabClosedHandler(tabId => this.onTabClosed(tabId));
        this.portResolver = new PortResolver(hostConstants.identityProtectionPortName, port => this.onUnresolvedPortConnected(port));
        this.analyseWebsiteScreenshotRequestHandler = new RequestResponseHandler(MessageType.analyseWebsiteScreenshotRequestV31, MessageType.analyseWebsiteScreenshotResponseV31, (id, requestData) => {
            const { url, screenshotBase64 } = requestData;
            return new AnalyseWebsiteScreenshotRequestV31(id, url, screenshotBase64);
        }, response => {
            const { id, result, url, identifiedBrandLogos } = response;
            return [id, { result, url, identifiedBrandLogos }];
        }, hostHelperMessageRouter, hostHelperMessageSender);
    }
    onConfigChanged(config) {
        if (config.identityProtection.enabled) {
            this.identityProtectionEnabled = true;
            this.identityProtectionConfig = config.identityProtection.config;
        }
        else {
            this.identityProtectionEnabled = false;
        }
        this.aiBrandLogoProtectionEnabled = config.aiBrandLogoProtectionEnabled;
        this.onChange();
    }
    onChange() {
        const ipEnabled = this.ipEnabled();
        for (const controller of this.tabControllers.values()) {
            controller.onChange(this.protocolVersion, ipEnabled, this.identityProtectionConfig, this.aiBrandLogoProtectionEnabled);
        }
        if (isMessageTypeSupported(MessageType.identityProtectionRunningV24, this.protocolVersion)) {
            this.hostHelperMessageSender.sendMessage(MessageType.identityProtectionRunningV24, { running: ipEnabled });
        }
    }
    onTabActivated(tabId) {
        var _a;
        (_a = this.tabControllers.get(tabId)) === null || _a === void 0 ? void 0 : _a.onActivated();
    }
    onTabClosed(tabId) {
        this.tabControllers.delete(tabId);
    }
    onLinkProtectionWouldBlock(event) {
        const payload = event.payload;
        if (payload.isGood) {
            return;
        }
        const tabController = this.tabControllers.get(payload.tabId);
        if (maybe_some(tabController)) {
            tabController.setLinkProtectionWouldBlock(payload);
        }
        else {
            this.pendingLinkProtectionEventPayloads.set(payload.tabId, payload);
        }
    }
    onNavigation(tabId, isFreshNavSeq) {
        const controller = this.tabControllers.get(tabId);
        if (isFreshNavSeq) {
            this.pendingLinkProtectionEventPayloads.delete(tabId);
            controller === null || controller === void 0 ? void 0 : controller.clearLinkProtectionWouldBlock();
        }
    }
    onUnresolvedPortConnected(port) {
        const tabId = readPortTabId(port);
        const frameId = readPortFrameId(port);
        if (maybe_none(tabId) || maybe_none(frameId)) {
            logError(`ContentScriptController: port missing tabId (${tabId}) or frameId (${frameId})`);
            return;
        }
        let tabController = this.tabControllers.get(tabId);
        if (maybe_none(tabController)) {
            tabController = new ContentScriptTabController(tabId, this.protocolVersion, this.ipEnabled(), this.aiBrandLogoProtectionEnabled, this.identityProtectionConfig, this.categoryTracker, this.onConfigured, this.hostHelperMessageSender, this.alertHelper, this.badgeManager, this.urlFilterer, this.analyseWebsiteScreenshotRequestHandler);
            this.tabControllers.set(tabId, tabController);
            const payload = this.pendingLinkProtectionEventPayloads.get(tabId);
            if (maybe_some(payload)) {
                tabController.setLinkProtectionWouldBlock(payload);
                this.pendingLinkProtectionEventPayloads.delete(tabId);
            }
        }
        tabController.addFrameController(frameId, port);
    }
    ipEnabled() {
        return !this.isDormant && this.identityProtectionEnabled;
    }
}

;// CONCATENATED MODULE: ./context-menus.ts






var ContextMenuIds;
(function (ContextMenuIds) {
    ContextMenuIds["brOpenLink"] = "BrOpenLink";
})(ContextMenuIds || (ContextMenuIds = {}));
class ContextMenuManager {
    constructor(browserLauncher, placementManager, errorHandler, configNotifier, onConfigured) {
        this.browserLauncher = browserLauncher;
        this.placementManager = placementManager;
        this.onConfigured = onConfigured;
        this.isDormant = false;
        this.menusCreated = false;
        this.sbxEnabled = true;
        this.secureBrowserRedirectTrustedSites = false;
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        onConfigured.registerListener(() => this.updateContextMenus());
        chrome.contextMenus.onClicked.addListener(itemData => this.onContextMenuClicked(itemData));
        errorHandler.onDormantStateChanged.registerEventHandler(state => this.onDormantStateChanged(state));
    }
    createContextMenus() {
        if (!this.menusCreated) {
            chrome.contextMenus.create({
                id: ContextMenuIds.brOpenLink,
                title: getI18n(I18nMessages.openLinkInSecureBrowser),
                contexts: ['link']
            }, () => suppressRuntimeErrors(["Cannot create item with duplicate id"]));
            this.menusCreated = true;
        }
    }
    removeContextMenus() {
        if (this.menusCreated) {
            chrome.contextMenus.removeAll();
            this.menusCreated = false;
        }
    }
    updateContextMenus() {
        if (!this.onConfigured.isConfigured) {
            return;
        }
        if (!this.isDormant && this.sbxEnabled) {
            this.createContextMenus();
        }
        else {
            this.removeContextMenus();
        }
    }
    onDormantStateChanged(state) {
        this.isDormant = state.isDormant;
        this.updateContextMenus();
    }
    onConfigChanged(config) {
        this.sbxEnabled = config.sbxEnabled;
        this.secureBrowserRedirectTrustedSites = config.secureBrowserRedirectTrustedSites;
        this.updateContextMenus();
    }
    onContextMenuClicked(itemData) {
        if ((itemData.menuItemId === ContextMenuIds.brOpenLink) && itemData.linkUrl) {
            log_log(`User wants to open link in secure browser: ${itemData.linkUrl}`);
            let url = url_utils_parseUrl(itemData.linkUrl);
            if (maybe_some(url)) {
                if (this.secureBrowserRedirectTrustedSites && this.placementManager.isTrustedUrl(url)) {
                    log_log(`Ignoring context menu click to open ${itemData.linkUrl} in the secure browser because the site `
                        + `is trusted and trusted site redirection for BrChrome is enabled`);
                    return;
                }
                this.browserLauncher.launchBrowser(url);
            }
        }
    }
}

;// CONCATENATED MODULE: ../lib/host/controller-alert-types.ts
var IPAnnotationType;
(function (IPAnnotationType) {
    IPAnnotationType["Unknown"] = "Unknown";
    IPAnnotationType["Malicious"] = "Malicious";
    IPAnnotationType["Suspicious"] = "Suspicious";
    IPAnnotationType["Safe"] = "Safe";
    IPAnnotationType["Test"] = "Test";
})(IPAnnotationType || (IPAnnotationType = {}));
class IPLavaExternalRef {
    constructor(sourceName = "", description = "") {
        this.sourceName = sourceName;
        this.description = description;
        this.url = "";
        this.externalId = "";
        this.showToCustomer = false;
    }
}
var RecordActivityType;
(function (RecordActivityType) {
    RecordActivityType["DroppedActivities"] = "droppedActivities";
    RecordActivityType["Navigation"] = "navigation";
    RecordActivityType["Redirect"] = "redirect";
    RecordActivityType["SbxLinkProtectionEvent"] = "sbxEvent";
})(RecordActivityType || (RecordActivityType = {}));

;// CONCATENATED MODULE: ./controller-alert-helper.ts












class ControllerAlertHelper {
    constructor(phishingCategoryTracker, handshaker, tabArchivist, hostHelperMessageSender) {
        this.phishingCategoryTracker = phishingCategoryTracker;
        this.handshaker = handshaker;
        this.tabArchivist = tabArchivist;
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.extensionId = chrome.runtime.id;
        this.extensionVersion = chrome.runtime.getManifest().version;
        this.ourUrlHostname = getCurrentBrowserInfo().urlHostname;
        handshaker.onHandshaken.registerEventHandler(event => {
            this.protocolVersion = event.negotiatedVersion;
        });
    }
    navTypeToActivityType(navType) {
        switch (navType) {
            case NavType.navigation:
                return RecordActivityType.Navigation;
            case NavType.redirect:
                return RecordActivityType.Redirect;
            default:
                return undefined;
        }
    }
    shouldIgnoreActivity(url) {
        if (isFileUrl(url)) {
            return url.href.includes(hostConstants.externalAppLinkNavigator) && url.href.includes(this.ourUrlHostname);
        }
        return isOwnExtensionUrl(url);
    }
    makeDroppedActivitiesRecord(droppedCount, firstDroppedActivity) {
        return {
            activity: RecordActivityType.DroppedActivities,
            droppedCount,
            timestamp: firstDroppedActivity.timestamp,
            tabId: firstDroppedActivity.tabId,
            url: ""
        };
    }
    makeLinkProtectionRecord(event) {
        var _a, _b;
        return {
            activity: RecordActivityType.SbxLinkProtectionEvent,
            timestamp: event.timeStamp,
            tabId: event.tabId,
            url: event.url,
            blockType: event.explanation.type,
            siteUrl: (_a = event.explanation.siteURL) !== null && _a !== void 0 ? _a : "",
            appName: (_b = event.explanation.appName) !== null && _b !== void 0 ? _b : "",
            vmInfo: event.explanation.vmInfo,
        };
    }
    convertTabNavSeq(tabId, navSeq, linkProtectionEvent) {
        let addedLinkProtectionEvent = false;
        const activities = new Array();
        for (const navData of navSeq) {
            const activity = this.navTypeToActivityType(navData.type);
            if (maybe_none(activity) || this.shouldIgnoreActivity(navData.url)) {
                continue;
            }
            const timestamp = navData.timeStamp;
            const url = navData.url.toString();
            activities.push({ timestamp, activity, tabId, url });
            if (maybe_some(linkProtectionEvent) && !addedLinkProtectionEvent) {
                const matchingEvent = linkProtectionEvent.timeStamp === timestamp
                    && linkProtectionEvent.tabId === tabId && linkProtectionEvent.url === url;
                if (matchingEvent) {
                    activities.push(this.makeLinkProtectionRecord(linkProtectionEvent));
                    addedLinkProtectionEvent = true;
                }
            }
        }
        if (maybe_some(linkProtectionEvent) && !addedLinkProtectionEvent) {
            logError("filterTabNavSeq: link protection event was provided but a matching nav could not be found");
            activities.push(this.makeLinkProtectionRecord(linkProtectionEvent));
        }
        const limit = 100;
        if (activities.length > limit) {
            const droppedCount = activities.length - (limit - 1);
            const firstDroppedActivity = activities[1];
            const droppedActivities = this.makeDroppedActivitiesRecord(droppedCount, firstDroppedActivity);
            return [activities[0], droppedActivities].concat(activities.slice(2 - limit));
        }
        else {
            return activities;
        }
    }
    getCategoryString(category) {
        switch (category) {
            case IPPageCategory.Allowed:
                return "whiteList";
            case IPPageCategory.Blocked:
                return "blackList";
            case IPPageCategory.Unknown:
                return "unknown";
            case IPPageCategory.UserAllowed:
                return "userAllowed";
        }
    }
    makeAnnotation(name, sourceName, description) {
        const externalRef = new IPLavaExternalRef(sourceName, description);
        return {
            name: name,
            type: IPAnnotationType.Malicious,
            externalRefs: [
                externalRef
            ]
        };
    }
    getUrlCategoryAnnotation(categoryDetails) {
        const source = categoryDetails.source();
        const category = this.getCategoryString(categoryDetails.category);
        const name = `url_${source}_${category}`;
        return this.makeAnnotation(name, source, category);
    }
    getSmartScreenAnnotation() {
        const name = "SmartScreen";
        const sourceName = name;
        const description = "The browser's SmartScreen filter has blocked the navigation";
        return this.makeAnnotation(name, sourceName, description);
    }
    sendPreparepPhishingReport(tabId, reportType, urlSpec, navSeq, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, screenshot, categoryDetails, linkProtectionEvent, logoAnalysis) {
        const activities = this.convertTabNavSeq(tabId, navSeq, linkProtectionEvent);
        const annotations = new Array();
        switch (reportType) {
            case IPReportType.CrendentialExtension:
                annotations.push(this.getUrlCategoryAnnotation(categoryDetails));
                break;
            case IPReportType.SmartScreen:
                annotations.push(this.getSmartScreenAnnotation());
                break;
        }
        if (isMessageTypeSupported(MessageType.preparePhishingReportV32, this.protocolVersion)) {
            const message = new PreparePhishingReportV32(tabId, Date.now(), this.extensionId, this.extensionVersion, this.cloudListVersion, reportType, urlSpec, screenshot, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, activities, annotations, logoAnalysis !== null && logoAnalysis !== void 0 ? logoAnalysis : new OnLogoAnalysisCompleteV31(false, false, undefined));
            this.hostHelperMessageSender.sendMessage(MessageType.preparePhishingReportV32, message);
        }
        else if (isMessageTypeSupported(MessageType.preparePhishingReportV28, this.protocolVersion)) {
            const message = new PreparePhishingReportV28(tabId, Date.now(), this.extensionId, this.extensionVersion, this.cloudListVersion, reportType, urlSpec, screenshot, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, activities, annotations);
            this.hostHelperMessageSender.sendMessage(MessageType.preparePhishingReportV28, message);
        }
        else {
            const message = new PreparePhishingReportV22(tabId, Date.now(), this.extensionId, this.extensionVersion, this.cloudListVersion, reportType, urlSpec, screenshot, activities, annotations);
            this.hostHelperMessageSender.sendMessage(MessageType.preparePhishingReportV22, message);
        }
    }
    prepareCredentialPhishingAlert(tabId, reportType, urlSpec, categoryDetails, screenshot, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, linkProtectionEvent, logoAnalysis) {
        const navSeq = this.tabArchivist.getTabCurrentNavSeq(tabId);
        if (maybe_none(navSeq)) {
            logError(`Credential phishing alert raised for tab ${tabId} but there is no activity`);
            return false;
        }
        this.sendPreparepPhishingReport(tabId, reportType, urlSpec, navSeq, statusCode, statusMsg, domainAgeDays, domainAgeDaysThreshold, screenshot, categoryDetails, linkProtectionEvent, logoAnalysis);
        return true;
    }
    sendSmartScreenAlert(tabId, urlSpec) {
        var _a;
        const navSeq = (_a = this.tabArchivist.getTabCurrentNavSeq(tabId)) !== null && _a !== void 0 ? _a : [];
        this.sendPreparepPhishingReport(tabId, IPReportType.SmartScreen, urlSpec, navSeq);
        this.sendPreparedPhishingAlert(tabId);
    }
    sendPreparedPhishingAlert(tabId) {
        this.hostHelperMessageSender.sendMessage(MessageType.sendPhishingReportV22, new SendPhishingReportV22(tabId));
    }
    get cloudListVersion() {
        return this.phishingCategoryTracker.cloudListVersion;
    }
    sendUrlFilteringAlert(tabId, urlSpec, blockingCategories, statusCode, statusMsg, overridden, domainAgeDays, domainAgeDaysThreshold, type) {
        const navSeq = this.tabArchivist.getTabCurrentNavSeq(tabId);
        if (maybe_none(navSeq)) {
            logError(`URL Filtering alert raised for tab ${tabId} but there is no activity`);
            return false;
        }
        const activities = this.convertTabNavSeq(tabId, navSeq);
        if (isMessageTypeSupported(MessageType.makeUrlFilteringAlertV28, this.protocolVersion)) {
            const message = new MakeUrlFilteringAlertV28(tabId, Date.now(), this.extensionId, this.extensionVersion, urlSpec, blockingCategories, statusCode, statusMsg, overridden, activities, domainAgeDays, domainAgeDaysThreshold, type);
            this.hostHelperMessageSender.sendMessage(MessageType.makeUrlFilteringAlertV28, message);
        }
        else if (isMessageTypeSupported(MessageType.makeUrlFilteringAlertV27, this.protocolVersion)) {
            const message = new MakeUrlFilteringAlertV27(tabId, Date.now(), this.extensionId, this.extensionVersion, urlSpec, blockingCategories, statusCode, statusMsg, overridden, activities);
            this.hostHelperMessageSender.sendMessage(MessageType.makeUrlFilteringAlertV27, message);
        }
        else {
            const message = new MakeUrlFilteringAlertV26(tabId, Date.now(), this.extensionId, this.extensionVersion, urlSpec, blockingCategories, activities);
            this.hostHelperMessageSender.sendMessage(MessageType.makeUrlFilteringAlertV26, message);
        }
        return true;
    }
}

;// CONCATENATED MODULE: ./download-tracker.ts




class DownloadTracker {
    constructor(messageSender, featureManager) {
        this.messageSender = messageSender;
        this.featureManager = featureManager;
        this.listenerManager = new ApiListenerManager();
        this.listenerManager.addEvent('downloads.onCreated', chrome.downloads.onCreated, this.onCreated.bind(this));
        this.listenerManager.addEvent('downloads.onChanged', chrome.downloads.onChanged, this.onChanged.bind(this));
    }
    onCreated(downloadItem) {
        var _a;
        const url = (_a = downloadItem.finalUrl) !== null && _a !== void 0 ? _a : downloadItem.url;
        log_log(`Download starting from ${url}`);
        if (!this.featureManager.isDownloadProtectionEnabled) {
            log_log("DownloadTracker: onCreated: download protection is not enabled");
            return;
        }
        const message = new DownloadCreatedV30(url, downloadItem.filename);
        this.messageSender.sendMessage(MessageType.downloadCreatedV30, message);
    }
    onChanged(downloadDelta) {
        if (downloadDelta.state &&
            (downloadDelta.state.current === 'complete')) {
            chrome.downloads.search({ id: downloadDelta.id }, this.foundDownloads.bind(this));
        }
    }
    foundDownloads(downloadItems) {
        var _a;
        if (downloadItems.length === 0) {
            return;
        }
        const downloadItem = downloadItems[0];
        const url = (_a = downloadItem.finalUrl) !== null && _a !== void 0 ? _a : downloadItem.url;
        log_log(`Download completed from ${url}`);
        if (!this.featureManager.isDownloadProtectionEnabled) {
            log_log("DownloadTracker: foundDownloads: download protection is not enabled");
            return;
        }
        const message = new DownloadCompleteV1(url, downloadItem.filename);
        this.messageSender.sendMessage(MessageType.downloadCompleteV1, message);
    }
    registerListeners() {
        this.listenerManager.registerListeners();
    }
    unregisterListeners() {
        this.listenerManager.unregisterListeners();
    }
}

;// CONCATENATED MODULE: ./web-request-event-source.ts


class BaseGatedWebRequestEvent {
    constructor(name) {
        this.name = name;
        this.isOpen = false;
    }
    open() {
        this.isOpen = true;
    }
    close() {
        this.isOpen = false;
    }
}
class GatedWebRequestEvent extends BaseGatedWebRequestEvent {
    constructor(event, name, callback, filter) {
        super(name);
        this.event = event;
        this.callback = callback;
        try {
            this.event.addListener(details => {
                if (this.isOpen) {
                    this.callback(details);
                }
            }, filter);
            log_log(`Registered gated web request listener for ${name}`);
        }
        catch (error) {
            logError(error);
            logError(`Failed to register gated web request listener for ${name}`);
        }
    }
}
class GatedWebRequestBlockingEvent extends BaseGatedWebRequestEvent {
    constructor(event, name, callback, filter, options) {
        super(name);
        this.event = event;
        this.callback = callback;
        try {
            this.event.addListener(details => {
                if (this.isOpen) {
                    return this.callback(details);
                }
                else {
                    return {
                        cancel: false
                    };
                }
            }, filter, options);
            log_log(`Registered gated web request listener for ${name}`);
        }
        catch (error) {
            logError(error);
            logError(`Failed to register gated web request listener for ${name}`);
        }
    }
}
class WebRequestEventSource {
    constructor() {
        this.listener = undefined;
        const filter = {
            urls: ['<all_urls>'],
            types: ['main_frame']
        };
        this.onBeforeRedirectEvent = new GatedWebRequestEvent(chrome.webRequest.onBeforeRedirect, 'chrome.webRequest.onBeforeRedirect', (details) => { var _a; return (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onBeforeRedirect(details); }, filter);
        this.onCompletedEvent = new GatedWebRequestEvent(chrome.webRequest.onCompleted, 'chrome.webRequest.onCompleted', (details) => { var _a; return (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onCompleted(details); }, filter);
        this.onErrorOccurredEvent = new GatedWebRequestEvent(chrome.webRequest.onErrorOccurred, 'chrome.webRequest.onErrorOccurred', (details) => { var _a; return (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onErrorOccurred(details); }, filter);
        this.onHeadersReceivedEvent = new GatedWebRequestBlockingEvent(chrome.webRequest.onHeadersReceived, 'chrome.webRequest.onHeadersReceived (blocking)', (details) => {
            var _a, _b;
            return (_b = (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onHeadersReceived(details)) !== null && _b !== void 0 ? _b : { cancel: false };
        }, filter, ['blocking', 'responseHeaders']);
        this.onBeforeRequestBlockingEvent = new GatedWebRequestBlockingEvent(chrome.webRequest.onBeforeRequest, 'chrome.webRequest.onBeforeRequest (blocking)', (details) => {
            var _a, _b;
            return (_b = (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onBeforeRequestBlocking(details)) !== null && _b !== void 0 ? _b : { cancel: false };
        }, filter, ['blocking']);
        this.onBeforeRequestEvent = new GatedWebRequestEvent(chrome.webRequest.onBeforeRequest, 'chrome.webRequest.onBeforeRequest', (details) => { var _a; return (_a = this.listener) === null || _a === void 0 ? void 0 : _a.onBeforeRequest(details); }, filter);
    }
    registerListener(listener) {
        if (maybe_some(this.listener)) {
            throw new Error("WebRequestEventSource already has a listener registered");
        }
        this.listener = listener;
    }
}

;// CONCATENATED MODULE: ./error-handler.ts













const maxFailedReloadAttempts = 2;
const maxFailedReconnectAttempts = 2;
class ExtensionReloader {
    constructor() {
        this.reload = doOnce(() => {
            this.readFailedReloadAttempts((failedReloadAttempts) => {
                this.reloadExtension(failedReloadAttempts);
            });
        });
        this.loadedSuccessfully = doOnce(() => {
            this.writeFailedReloadAttempts({ failedReloadAttempts: 0, isReload: false }, () => {
                log_log(`ExtensionReloader.loadedSuccessfully: reset failedReloadAttempts`);
            });
        });
        chrome.runtime.onStartup.addListener(() => this.onStartup());
        this.readFailedReloadAttempts(failedReloadAttemps => {
            log_log(`ExtensionReloader.constructor: failedReloadAttempts == ${failedReloadAttemps}`);
        });
    }
    onStartup() {
        log_log("ExtensionReloader.onStartup");
        this.loadedSuccessfully();
    }
    readFailedReloadAttempts(callback) {
        const key = StorageKey.failedReloadAttempts;
        chrome.storage.local.get(key, (items) => {
            const errorMessage = checkRuntimeLastError();
            if (maybe_some(errorMessage)) {
                logError(`ExtensionReloader.readFailedReloadAttempts: error: ${errorMessage}`);
                return;
            }
            const failedReloadAttempts = items[key];
            if (isNumber(failedReloadAttempts)) {
                callback(failedReloadAttempts);
            }
            else {
                callback(0);
            }
        });
    }
    writeFailedReloadAttempts(args, callback) {
        const key = StorageKey.failedReloadAttempts;
        chrome.storage.local.set({
            [key]: args.failedReloadAttempts
        }, () => {
            const errorMessage = checkRuntimeLastError();
            if (maybe_some(errorMessage)) {
                logError(`ExtensionReloader.writeFailedReloadAttempts: error: ${errorMessage}`);
                return;
            }
            callback();
        });
    }
    reloadExtension(failedReloadAttempts) {
        if (failedReloadAttempts < maxFailedReloadAttempts) {
            this.writeFailedReloadAttempts({ failedReloadAttempts: failedReloadAttempts + 1, isReload: true }, () => {
                log_log(`ExtensionReloader.reloadExtension: reloading extension attempt: ${failedReloadAttempts}`);
                chrome.runtime.reload();
            });
        }
    }
}
class ErrorHandler {
    constructor(messageRouter, configNotifier, onConfiguredRaiser) {
        this.onConfiguredRaiser = onConfiguredRaiser;
        this.onDormantStateChanged = new EventDispatcher();
        this.sendMessage = (type, payload) => {
            if (maybe_none(this.messageSender)) {
                throw new Error("ErrorHandler.sendMessage: this.messageSender === undefined");
            }
            this.messageSender.sendMessage(type, payload);
        };
        this.lastError = ChragError.recoveredFromError;
        this._isDormant = false;
        this.extensionReloader = new ExtensionReloader();
        this.messageSender = undefined;
        messageRouter.registerMessagePayloadHandler(MessageType.helperErrorV1, payload => {
            this.raiseError(payload.errorType, new Error(payload.errorMessage));
        });
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onBrowserLaunchEvent(event) {
        if (event.didLaunch) {
            this.extensionReloader.loadedSuccessfully();
        }
        else {
            this.raiseError(ChragError.launchBrowserFailed, new Error(`Failed browser launch event: ${string_utils_toString(event)}`));
        }
    }
    get isDormant() {
        return this._isDormant;
    }
    sendDormantState() {
        try {
            this.sendMessage(MessageType.dormantStateChangedV1, new DormantStateChangedV1(this.isDormant));
        }
        catch (e) {
            logError(e);
        }
    }
    updateDormantState(isDormant, errorCode) {
        this._isDormant = isDormant;
        this.onDormantStateChanged.dispatchEvent({ isDormant, errorCode });
        if (errorCode !== ChragError.notEnabled) {
            this.sendDormantState();
        }
    }
    enterDormantState(errorCode) {
        if (!this.isDormant) {
            logError("Chrag has encountered a fatal error and is entering a dormant state.");
        }
        this.updateDormantState(true, errorCode);
    }
    wakeFromDormantState(lastErrorCode) {
        if (this.isDormant) {
            logError("Chrag has recovered and is reactivating (waking from a dormant state).");
        }
        this.updateDormantState(false, lastErrorCode);
    }
    reloadExtension() {
        log_log("ErrorHandler.reloadExtension");
        this.extensionReloader.reload();
    }
    handleHelperError(errorCode) {
        log_log(`ErrorHandler.handleHelperError: ${ChragError[errorCode]}`);
        try {
            this.enterDormantState(errorCode);
        }
        catch (e) {
            logError(e);
        }
        try {
            this.reloadExtension();
        }
        finally {
            this.onConfiguredRaiser.onConfigured();
        }
    }
    raiseError(errorCode, e) {
        if (e) {
            logError(e);
        }
        if (errorCode === this.lastError && errorCode !== ChragError.notEnabled) {
            return;
        }
        errorCode = this.validateError(errorCode);
        if (errorCode !== this.lastError) {
            logError(`ChragError raised: ${ChragError[errorCode]}`);
        }
        try {
            switch (errorCode) {
                case ChragError.helperPortError:
                case ChragError.handshakeError:
                case ChragError.helperUnresponsive:
                    this.handleHelperError(errorCode);
                    break;
                case ChragError.trustDownloadFailed:
                    break;
                case ChragError.recoveredFromError:
                    this.wakeFromDormantState(this.lastError);
                    break;
                case ChragError.notEnabled:
                case ChragError.launchBrowserFailed:
                case ChragError.unknownError:
                default:
                    this.enterDormantState(errorCode);
                    break;
            }
        }
        finally {
            this.lastError = errorCode;
        }
    }
    onConfigChanged(config) {
        const { enabled } = config.isExtensionEnabled;
        if (!enabled) {
            this.raiseError(ChragError.notEnabled);
        }
        else if (this.isDormant && this.lastError === ChragError.notEnabled) {
            this.raiseError(ChragError.recoveredFromError);
        }
    }
    setup(messageSender, connection) {
        this.messageSender = messageSender;
        connection.onConnectionStateChanged.registerEventHandler((event) => {
            if (event.newState === ConnectionState.Connected) {
                if (this.isDormant) {
                    switch (this.lastError) {
                        case ChragError.helperPortError:
                            this.raiseError(ChragError.recoveredFromError);
                            break;
                        case ChragError.helperUnresponsive:
                            this.raiseError(ChragError.recoveredFromError);
                            break;
                        default:
                            break;
                    }
                }
            }
        });
    }
    validateError(error) {
        if (isChragError(error)) {
            return error;
        }
        else {
            logError(`Unknown error code: ${error}`);
            return ChragError.unknownError;
        }
    }
}

;// CONCATENATED MODULE: ./external-app-link-controller.ts












class ExternalAppLinkPageController {
    constructor(tabId, port, onDisconnect, hostHelpermessageSender, onConfigured, linkProtectionService) {
        this.tabId = tabId;
        this.linkProtectionService = linkProtectionService;
        this.pagePortController = new PagePortController(tabId, port, undefined, (port) => onDisconnect(port, tabId), hostHelpermessageSender, onConfigured);
        this.pagePortController.registerMessagePayloadHandler(MessageType.externalAppLinkRequestV16, (message) => this.handleRequest(message));
        this.pagePortController.connect();
    }
    handleRequest(request) {
        log_log(`ExternalAppLinkPageController.handleExternalAppLink: ${string_utils_toString({
            tabId: this.tabId,
            linkSpec: request.linkSpec,
            externalAppName: request.externalAppName,
            vmid: request.vmid,
        })}`);
        this.linkProtectionService.registerExternalAppLink(this.tabId, request.externalAppName, request.vmid);
        this.pagePortController.sendMessage(MessageType.externalAppLinkResponseV1, { navigateToSpec: "" });
    }
}
class ExternalAppLinkController {
    constructor(onConfigured, hostHelpermessageSender, linkProtectionService) {
        this.onConfigured = onConfigured;
        this.hostHelpermessageSender = hostHelpermessageSender;
        this.linkProtectionService = linkProtectionService;
        this.onUnresolvedConnection = new EventDispatcher();
        this.externalAppLinkPage = undefined;
        this.pageControllers = new Map();
        this.externalAppLinkPage = url_utils_parseUrl(chrome.runtime.getURL(hostConstants.externalAppLinkPage));
        this.portResolver = new PagePortResolver(hostConstants.externalAppLinkPagePortName, (tabId, port) => this.onUnresolvedPortConnected(tabId, port), (url) => this.isExternalAppLinkURL(url));
    }
    isExternalAppLinkURL(url) {
        if (maybe_none(url) || maybe_none(this.externalAppLinkPage)) {
            return false;
        }
        return url_utils_isSameUrl(url, this.externalAppLinkPage, UrlCompareOptions.IgnoreSearchParams);
    }
    onExternalAppLinkDetected(tabId) {
        const port = this.portResolver.resolvePort(tabId);
        this.addPageController(tabId, port);
    }
    addPageController(tabId, port) {
        const onPortDisconnected = (port, tabId) => {
            this.onPortDisconnected(port, tabId);
        };
        const pageController = new ExternalAppLinkPageController(tabId, port, onPortDisconnected, this.hostHelpermessageSender, this.onConfigured, this.linkProtectionService);
        this.pageControllers.set(tabId, pageController);
    }
    onPortDisconnected(port, tabId) {
        this.pageControllers.delete(tabId);
        removeExtensionPageFromHistoryAfterClosing(port);
    }
    onUnresolvedPortConnected(tabId, port) {
        log_log(`ExternalAppLinkController.onUnexpectedPortConnected: tabId: ${tabId}`);
        this.onUnresolvedConnection.dispatchEvent({ tabId, url: readPortPageUrl(port) });
        this.addPageController(tabId, makePromise(() => port));
    }
}

;// CONCATENATED MODULE: ../lib/host/blocked-file-page-options.ts
var blocked_file_page_options_OptionNames;
(function (OptionNames) {
    OptionNames["fileUrlSpec"] = "fileUrlSpec";
})(blocked_file_page_options_OptionNames || (blocked_file_page_options_OptionNames = {}));

;// CONCATENATED MODULE: ./file-blocker.ts














class BlockedFilePageController {
    constructor(tabId, port, onDisconnect, fileUrlTracker, browserLauncher, hostHelpermessageSender, onConfigured) {
        this.tabId = tabId;
        this.port = port;
        this.onDisconnect = onDisconnect;
        this.fileUrlTracker = fileUrlTracker;
        this.browserLauncher = browserLauncher;
        this.pagePortController = new PagePortController(tabId, port, undefined, (port) => this.onPortDisconnected(port), hostHelpermessageSender, onConfigured);
        this.pagePortController.registerMessagePayloadHandler(MessageType.blockedFileRequestV1, (message) => this.handleRequest(message));
        this.pagePortController.connect();
    }
    closeTab() {
        chrome.tabs.remove(this.tabId, () => {
            log_log(`BlockedFilePageController.closeTab: tabId: ${this.tabId}`);
        });
    }
    handleRequest(request) {
        const fileUrl = url_utils_parseUrl(request.fileUrlSpec);
        if (maybe_none(fileUrl) || !isFileUrl(fileUrl)) {
            this.closeTab();
            return;
        }
        this.fileUrlTracker.queryFileUrlTrustedness(fileUrl, (fileUrl, isTrusted) => {
            log_log(`BlockedFilePageController.handleRequest: ${string_utils_toString({
                fileUrl: fileUrl,
                isTrusted: isTrusted
            })}`);
            if (!isTrusted) {
                this.browserLauncher.launchBrowserAndCloseTabOrNavigateTab(this.tabId, fileUrl, unknownContentType);
            }
            else {
                this.sendResponse(fileUrl, isTrusted);
            }
        });
    }
    sendResponse(fileUrl, isTrusted) {
        this.pagePortController.sendMessage(MessageType.blockedFileResponseV1, new BlockedFileResponseV1(URLToString(fileUrl), isTrusted));
    }
    onPortDisconnected(port) {
        this.onDisconnect(port, this.tabId);
    }
}
class FileBlocker {
    constructor(fileUrlTracker, browserLauncher, hostHelpermessageSender, onConfigured) {
        this.fileUrlTracker = fileUrlTracker;
        this.browserLauncher = browserLauncher;
        this.hostHelpermessageSender = hostHelpermessageSender;
        this.onConfigured = onConfigured;
        this.pageControllers = new Map();
        const blockedFilePageSpec = chrome.runtime.getURL(hostConstants.blockedFilePage);
        const blockedFilePageURL = url_utils_parseUrl(blockedFilePageSpec);
        if (maybe_none(blockedFilePageURL)) {
            throw new Error(`FileBlocker.constructor: invalid blockedFilePageURL: ${hostConstants.blockedFilePage}`);
        }
        this.blockedFilePageURL = blockedFilePageURL;
        this.pagePortResolver = new PagePortResolver(hostConstants.blockedFilePagePortName, (tabId, port) => this.onUnresolvedPagePortConnected(tabId, port), (url) => this.isBlockedFilePageURL(url));
    }
    isBlockedFilePageURL(url) {
        if (maybe_none(url) || maybe_none(this.blockedFilePageURL)) {
            return false;
        }
        return url_utils_isSameUrl(url, this.blockedFilePageURL, UrlCompareOptions.IgnoreSearchParams);
    }
    makeBlockedFilePageURL(fileUrl) {
        const urlEncoder = new UrlEncoder(this.blockedFilePageURL);
        urlEncoder.addUrlQueryParam(blocked_file_page_options_OptionNames.fileUrlSpec, fileUrl);
        const blockedFilePageURL = urlEncoder.encodeUrl();
        if (maybe_none(blockedFilePageURL)) {
            return this.blockedFilePageURL;
        }
        return blockedFilePageURL;
    }
    addBlockedFilePageController(tabId, port) {
        const controller = new BlockedFilePageController(tabId, port, (port, tabId) => this.onPageDisconnected(port, tabId), this.fileUrlTracker, this.browserLauncher, this.hostHelpermessageSender, this.onConfigured);
        this.pageControllers.set(tabId, controller);
    }
    onPageDisconnected(port, tabId) {
        this.pageControllers.delete(tabId);
        removeExtensionPageFromHistoryAfterClosing(port);
    }
    onUnresolvedPagePortConnected(tabId, port) {
        this.addBlockedFilePageController(tabId, makePromise(() => port));
    }
    blockFile(fileUrl, tabId) {
        const port = this.pagePortResolver.resolvePort(tabId);
        this.addBlockedFilePageController(tabId, port);
        const blockedFilePageURL = this.makeBlockedFilePageURL(fileUrl);
        return blockedFilePageURL;
    }
}

;// CONCATENATED MODULE: ./host-helper-connection.ts

function createHostHelperPort() {
    return chrome.runtime.connectNative(hostConstants.hostHelperId);
}

;// CONCATENATED MODULE: ./host-helper-channel.ts










class HelperPortChannel {
    constructor(errorHandler, messageRouter) {
        this.errorHandler = errorHandler;
        this.messageRouter = messageRouter;
        this.onHandshaken = new EventDispatcher();
        this.onConnectionStateChanged = new EventDispatcher();
        this.failedReconnectAttempts = 0;
        this.messageSender = new MessageSender((message) => this.sendMessage(message));
        this.channel = this.makeConnection();
    }
    makeConnection() {
        const createPort = makePromise(() => {
            return createHostHelperPort();
        });
        const channel = new MessagePortChannel(createPort, (port) => this.onPortConnected(port), (port) => this.onPortDisconnected(port), (e) => this.onPortError(e), (e) => this.onHandshakeError(e), this.messageRouter, Negotiation.NegotiateProtocolVersion);
        channel.onHandshaken.registerEventHandler((event) => {
            log_log("HostHelperChannel: extension is handshaken");
            this.onHandshaken.dispatchEvent(event);
        });
        channel.onConnectionStateChanged.registerEventHandler((event) => this.onConnectionStateChanged.dispatchEvent(event));
        return channel;
    }
    connect() {
        console.log("HostHelperChannel.connect");
        this.channel.connect();
    }
    disconnect() {
        console.log("HostHelperChannel.disconnect");
        this.channel.disconnect();
    }
    sendMessage(message) {
        return this.channel.sendMessage(message);
    }
    onPortConnected(port) {
        console.log("HostHelperChannel.onPortConnected");
    }
    onPortDisconnected(port) {
        const lastError = checkRuntimeLastError();
        const errorStr = maybe_some(lastError) ? `: '${lastError}'` : "";
        console.log(`HostHelperChannel.onPortDisconnected${errorStr} failedReconnectAttempts: ${this.failedReconnectAttempts}`);
        if (this.failedReconnectAttempts < maxFailedReconnectAttempts) {
            try {
                this.channel = this.makeConnection();
                this.channel.connect();
            }
            finally {
                this.failedReconnectAttempts += 1;
            }
        }
        else {
            this.errorHandler.raiseError(ChragError.helperPortError, new Error("hostHelperChannel.onPortDisconnected" + errorStr));
        }
    }
    onPortError(e) {
        console.log(`HostHelperChannel.onPortError: ${e}`);
        this.errorHandler.raiseError(ChragError.helperPortError, e);
    }
    onHandshakeError(e) {
        console.log(`HostHelperChannel.onHandshakeError: ${e}`);
        this.errorHandler.raiseError(ChragError.handshakeError, e);
    }
    get isHandshaken() {
        return this.channel.isHandshaken;
    }
    get negotiatedVersion() {
        return this.channel.negotiatedVersion;
    }
    get connectionState() {
        return this.channel.connectionState;
    }
}

;// CONCATENATED MODULE: ../lib/common/link-protection-service-types.ts
var LinkProtectionServiceEventType;
(function (LinkProtectionServiceEventType) {
    LinkProtectionServiceEventType["linkProtectionServiceEvent"] = "linkProtectionServiceEvent";
})(LinkProtectionServiceEventType || (LinkProtectionServiceEventType = {}));
var BlockEventTypes;
(function (BlockEventTypes) {
    BlockEventTypes["phishingSourceSite"] = "phishingSourceSite";
    BlockEventTypes["uncategorized"] = "uncategorized";
    BlockEventTypes["navSequence"] = "navSequence";
    BlockEventTypes["externalNavSequence"] = "externalNavSequence";
    BlockEventTypes["untrusted"] = "untrusted";
})(BlockEventTypes || (BlockEventTypes = {}));

;// CONCATENATED MODULE: ./link-protection-service.ts








class LinkProtectionService {
    constructor(configNotifier, tabClosedNotifier) {
        this.onEvent = new EventDispatcher();
        this.linkProtectionServiceConsumers = [];
        this.externalAppLinkSources = new Map();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        tabClosedNotifier.registerOnTabClosedHandler(tabId => this.externalAppLinkSources.delete(tabId));
    }
    onConfigChanged(config) {
        if (maybe_some(config.linkProtectionServiceConsumers)) {
            if (config.linkProtectionServiceConsumers.sbxSecureBrowserMode) {
                this.linkProtectionServiceConsumers = config.linkProtectionServiceConsumers.secureBrowser;
                return;
            }
            switch (currentBrowser) {
                case Browser.chrome:
                    this.linkProtectionServiceConsumers = config.linkProtectionServiceConsumers.chrome;
                    return;
                case Browser.firefox:
                    this.linkProtectionServiceConsumers = config.linkProtectionServiceConsumers.firefox;
                    return;
                case Browser.edgeChromium:
                    this.linkProtectionServiceConsumers = config.linkProtectionServiceConsumers.edgeChromium;
                    return;
            }
            const allConsumers = new Set([...config.linkProtectionServiceConsumers.chrome,
                ...config.linkProtectionServiceConsumers.firefox,
                ...config.linkProtectionServiceConsumers.edgeChromium,
                ...config.linkProtectionServiceConsumers.secureBrowser]);
            this.linkProtectionServiceConsumers = [...allConsumers];
        }
    }
    sendMessageCB(response) {
        const errorMessage = checkRuntimeLastError();
        if (maybe_some(errorMessage)) {
            logError(errorMessage);
        }
    }
    sendEventToOtherExtensions(event) {
        for (const extensionId of this.linkProtectionServiceConsumers) {
            try {
                log_log(`LinkProtectionService: sending ${event.payload.explanation.type} event to ${extensionId}`);
                chrome.runtime.sendMessage(extensionId, event, response => this.sendMessageCB(response));
            }
            catch (e) {
                logError(e);
            }
        }
    }
    raiseEventBase(tabId, timeStamp, url, explanation) {
        const header = { version: 1, type: LinkProtectionServiceEventType.linkProtectionServiceEvent };
        const payload = { isGood: false, tabId, timeStamp, url: URLToString(url), explanation };
        const event = { header, payload };
        this.onEvent.dispatchEvent(event);
        this.sendEventToOtherExtensions(event);
    }
    raiseBlockEvent(tabId, timeStamp, destURL, originURL) {
        this.raiseEventBase(tabId, timeStamp, destURL, { type: BlockEventTypes.phishingSourceSite, siteURL: URLToString(originURL) });
    }
    raiseBlockUncategorizedEvent(tabId, timeStamp, destURL) {
        this.raiseEventBase(tabId, timeStamp, destURL, { type: BlockEventTypes.uncategorized });
    }
    raiseBlockWithNavSequenceEvent(tabId, timeStamp, destURL, blockedNavSequence) {
        if (blockedNavSequence.involvesExternalApp) {
            const [appName, vmInfo] = this.externalAppLinkSources.get(tabId) || ["", undefined];
            this.raiseEventBase(tabId, timeStamp, destURL, { type: BlockEventTypes.externalNavSequence, appName, vmInfo });
        }
        else {
            this.raiseEventBase(tabId, timeStamp, destURL, { type: BlockEventTypes.navSequence });
        }
    }
    raiseBlockUntrustedEvent(tabId, timeStamp, destURL) {
        this.raiseEventBase(tabId, timeStamp, destURL, { type: BlockEventTypes.untrusted });
    }
    registerExternalAppLink(tabId, externalAppName, vmid) {
        const vmInfo = maybe_some(vmid) ? { id: parseInt(vmid) } : undefined;
        this.externalAppLinkSources.set(tabId, [externalAppName, vmInfo]);
    }
}

;// CONCATENATED MODULE: ./default-nav-sequence-detector-rules.ts
const defaultRules = {
    "version": 2,
    "builtinRulesPrecedence": 1000,
    "seqs": [
        {
            "seq": [
                ["parentTab", "<webMailSiteUrl>"],
                ["navigateTo", "$exemptEmailRewriter"],
                ["navigateTo", "<anyUrl>"]
            ],
            "metadata": {
                "precedence": 1303,
                "allow": true
            }
        },
        {
            "seq": [
                ["parentTab", "<webMailSiteUrl>"],
                ["navigateTo", "$exemptEmailRewriter"],
                ["repeat", "redirectTo", "$exemptEmailRewriter"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1302,
                "allow": true
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "$exemptEmailRewriter"],
                ["navigateTo", "<anyUrl>"]
            ],
            "metadata": {
                "precedence": 1301,
                "allow": true
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "$exemptEmailRewriter"],
                ["repeat", "redirectTo", "$exemptEmailRewriter"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1300,
                "allow": true
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "https://www.google.com"],
                ["navigateTo", "not", "<trustedUrl>"]
            ],
            "metadata": {
                "precedence": 1252,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "https://www.google.com"],
                ["navigateTo", "<trustedUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1251,
                "block": true,
                "navigateTo": 6
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "not", "<trustedUrl>"]
            ],
            "metadata": {
                "precedence": 1202,
                "block": true,
                "navigateTo": 3
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "<trustedUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1201,
                "block": true,
                "navigateTo": 5
            }
        },
        {
            "seq": [
                ["parentTab", "$gmail"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "https://www.google.com"],
                ["navigateTo", "<trustedUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1153,
                "block": true,
                "navigateTo": 6
            }
        },
        {
            "seq": [
                ["parentTab", "$gmail"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "https://www.google.com"],
                ["navigateTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1152,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["parentTab", "$gmail"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "<trustedUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1103,
                "block": true,
                "navigateTo": 5
            }
        },
        {
            "seq": [
                ["parentTab", "$gmail"],
                ["navigateTo", "https://www.google.com"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 1102,
                "block": true,
                "navigateTo": 3
            }
        },
        {
            "seq": [
                ["parentTab", "$gmail"],
                ["navigateTo", "$allowedGoogleApps"]
            ],
            "metadata": {
                "precedence": 1101,
                "allow": true
            }
        },
        {
            "seq": [
                ["parentTab", "<webMailSiteUrl>"],
                ["navigateTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 900,
                "block": true,
                "navigateTo": 2
            }
        },
        {
            "seq": [
                ["parentTab", "<webMailSiteUrl>"],
                ["navigateTo", "<trustedUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 800,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "<phishingSourceSiteUrl>"],
                ["redirectTo", "not", "<trustedUrl>"]
            ],
            "metadata": {
                "precedence": 751,
                "block": true,
                "navigateTo": 3
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "<phishingSourceSiteUrl>"],
                ["redirectTo", "<trustedUrl>"]
            ],
            "metadata": {
                "precedence": 750,
                "allow": true,
                "navigateTo": 3
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "not", "<trustedUrl>"]
            ],
            "metadata": {
                "precedence": 700,
                "block": true,
                "navigateTo": 2
            }
        },
        {
            "seq": [
                ["parentTab", "<webMailSiteUrl>"],
                ["navigateTo", "$navigatingEmailRewriter"],
                ["navigateTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 601,
                "block": true,
                "navigateTo": 3
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "$navigatingEmailRewriter"],
                ["navigateTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 600,
                "block": true,
                "navigateTo": 3
            }
        },
        {
            "seq": [
                ["navigateTo", "<externalAppLink>"],
                ["navigateTo", "<trustedUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "<uncategorizedUrl>"]
            ],
            "metadata": {
                "precedence": 500,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["parentTab", "not", "<trustedUrl>"],
                ["navigateTo", "not", "<trustedUrl>"],
                ["Content-Type", "application/pdf"]
            ],
            "metadata": {
                "precedence": 103,
                "block": true,
                "navigateTo": 2
            }
        },
        {
            "seq": [
                ["parentTab", "not", "<trustedUrl>"],
                ["navigateTo", "<anyUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "not", "<trustedUrl>"],
                ["Content-Type", "application/pdf"]
            ],
            "metadata": {
                "precedence": 102,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["navigateTo", "not", "<trustedUrl>"],
                ["navigateTo", "not", "<trustedUrl>"],
                ["Content-Type", "application/pdf"]
            ],
            "metadata": {
                "precedence": 100,
                "block": true,
                "navigateTo": 2
            }
        },
        {
            "seq": [
                ["navigateTo", "not", "<trustedUrl>"],
                ["navigateTo", "<anyUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "not", "<trustedUrl>"],
                ["Content-Type", "application/pdf"]
            ],
            "metadata": {
                "precedence": 100,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["navigateTo", "<anyUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "not", "<trustedUrl>"],
                ["navigateTo", "not", "<trustedUrl>"],
                ["Content-Type", "application/pdf"]
            ],
            "metadata": {
                "precedence": 100,
                "block": true,
                "navigateTo": 4
            }
        },
        {
            "seq": [
                ["navigateTo", "<anyUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "not", "<trustedUrl>"],
                ["navigateTo", "<anyUrl>"],
                ["repeat", "redirectTo", "<anyUrl>"],
                ["redirectTo", "not", "<trustedUrl>"],
                ["Content-Type", "application/pdf"]
            ],
            "metadata": {
                "precedence": 100,
                "block": true,
                "navigateTo": 6
            }
        }
    ]
};

;// CONCATENATED MODULE: ../lib/common/iter-utils.ts

function iter_utils_first(elements) {
    for (const element of elements) {
        return element;
    }
    return undefined;
}
function iter_utils_last(elements) {
    let lastElement = undefined;
    for (const element of elements) {
        lastElement = element;
    }
    return lastElement;
}
function count(elements) {
    let count = 0;
    for (const element of elements) {
        count += 1;
    }
    return count;
}
function toArray(elements) {
    let array = [];
    for (const element of elements) {
        array.push(element);
    }
    return array;
}
function* filter(elements, predicate) {
    for (const element of elements) {
        if (predicate(element)) {
            yield element;
        }
    }
}
function* map(elements, transform) {
    for (const element of elements) {
        yield transform(element);
    }
}
function iter_utils_isEmpty(elements) {
    for (const element of elements) {
        return false;
    }
    return true;
}
function iter_utils_has(elements, predicate) {
    return !iter_utils_isEmpty(filter(elements, predicate));
}
function iter_utils_isEqual(a, b) {
    return a === b;
}
function contains(elements, value, compare = iter_utils_isEqual) {
    for (const element of elements) {
        if (compare(element, value)) {
            return true;
        }
    }
    return false;
}
function* intersect(as, bs, compare = iter_utils_isEqual) {
    for (const a of as) {
        if (contains(bs, a, compare)) {
            yield a;
        }
    }
}
function* setDifference(as, bs, compare = iter_utils_isEqual) {
    for (const a of as) {
        if (!contains(bs, a, compare)) {
            yield a;
        }
    }
}
function max(elements, choose) {
    let chosen = undefined;
    for (const element of elements) {
        if (some(chosen)) {
            chosen = choose(chosen, element);
        }
        else {
            chosen = element;
        }
    }
    return chosen;
}

;// CONCATENATED MODULE: ./nav-sequence-detector.ts














class PartialNavSequence {
    constructor(navSequenceId, id, partialLength, completeLength) {
        this.navSequenceId = navSequenceId;
        this.id = id;
        this.partialLength = partialLength;
        this.completeLength = completeLength;
    }
    get isPartial() {
        return this.partialLength < this.completeLength;
    }
    get isComplete() {
        return this.partialLength === this.completeLength;
    }
    hashWithSeed(seed) {
        let hash = seed;
        hash = murmur_hash_murmurHash(this.navSequenceId, hash);
        hash = murmur_hash_murmurHash(this.id, hash);
        hash = murmur_hash_murmurHash(this.partialLength, hash);
        hash = murmur_hash_murmurHash(this.completeLength, hash);
        return hash;
    }
    hash() {
        const seed = 0;
        return this.hashWithSeed(seed);
    }
    compare(other) {
        return (this.navSequenceId === other.navSequenceId) &&
            (this.id === other.id) &&
            (this.partialLength === other.partialLength) &&
            (this.completeLength === other.completeLength);
    }
    get asBackRef() {
        return this.id;
    }
    get asIndex() {
        return this.partialLength - 1;
    }
    get asNextIndex() {
        if (this.isComplete) {
            return undefined;
        }
        return this.partialLength;
    }
}
class NavData {
    constructor(type, timeStamp, url, origin, categories, groups) {
        this.type = type;
        this.timeStamp = timeStamp;
        this.url = url;
        this.origin = origin;
        this.categories = categories;
        this.groups = groups;
        this.isNewTab = undefined;
        this.didUserCreateTab = undefined;
        this.contentType = undefined;
    }
    get isParentTab() {
        return this.type === NavType.parentTab;
    }
}
function isSameNavData(a, b) {
    return (a.type === b.type) &&
        isSameUrl(a.url, b.url) &&
        isSameOrigin(a.origin, b.origin) &&
        (a.categories === b.categories);
}
class TrackedNavSequence {
    constructor(metadata) {
        this.metadata = metadata;
        this.sequence = [];
        this.boundBackRefs = new Map();
    }
    push(navData, partialNavSequence) {
        this.sequence.push(navData);
        const backRef = partialNavSequence.asBackRef;
        this.boundBackRefs.set(backRef, navData);
    }
    get(index) {
        return this.sequence[index];
    }
    lookupBackRefBinding(backRef) {
        return this.boundBackRefs.get(backRef);
    }
    get precedence() {
        if (maybe_none(this.metadata)) {
            return undefined;
        }
        return this.metadata.precedence;
    }
    get involvesExternalApp() {
        return this.sequence.some(navData => (navData.categories & UrlCategory.externalAppLink) !== 0);
    }
    get length() {
        return this.sequence.length;
    }
    get navigateToURL() {
        if (maybe_none(this.metadata)) {
            if (isEmpty(this.sequence)) {
                return undefined;
            }
            const navData = last(this.sequence);
            return navData.url;
        }
        if (maybe_none(this.metadata.navigateTo)) {
            return undefined;
        }
        const navData = this.boundBackRefs.get(this.metadata.navigateTo);
        if (maybe_none(navData)) {
            return undefined;
        }
        return navData.url;
    }
    get navSequence() {
        return this.sequence;
    }
}
class EmptyNavSequenceDetection {
    get precedence() {
        return undefined;
    }
    get involvesExternalApp() {
        return false;
    }
    get navSequence() {
        return [];
    }
    get navigateToURL() {
        return undefined;
    }
}
class EmptyNavSequenceDetections {
    get precedence() {
        return undefined;
    }
    get shouldBlock() {
        return false;
    }
    get shouldPossiblyBlock() {
        return false;
    }
    get shouldAllow() {
        return false;
    }
    get shouldPossiblyAllow() {
        return false;
    }
    get blocked() {
        return new EmptyNavSequenceDetection();
    }
    get possibleBlocked() {
        return new EmptyNavSequenceDetection();
    }
    get allowed() {
        return new EmptyNavSequenceDetection();
    }
    get possibleAllowed() {
        return new EmptyNavSequenceDetection();
    }
}
var BlockType;
(function (BlockType) {
    BlockType[BlockType["none"] = 0] = "none";
    BlockType[BlockType["block"] = 1] = "block";
    BlockType[BlockType["allow"] = 2] = "allow";
})(BlockType || (BlockType = {}));
var DetectedType;
(function (DetectedType) {
    DetectedType[DetectedType["none"] = 0] = "none";
    DetectedType[DetectedType["detected"] = 1] = "detected";
    DetectedType[DetectedType["possiblyDetected"] = 2] = "possiblyDetected";
})(DetectedType || (DetectedType = {}));
class ResolvedDetectionAction {
    constructor(precedence, block, detected) {
        this.precedence = precedence;
        this.block = block;
        this.detected = detected;
    }
    get isBlocked() {
        return this.block === BlockType.block;
    }
    get isAllowed() {
        return this.block === BlockType.allow;
    }
    get isDetected() {
        return this.detected === DetectedType.detected;
    }
    get isPossiblyDetected() {
        return this.detected === DetectedType.possiblyDetected;
    }
    get shouldBlock() {
        return this.isBlocked && this.isDetected;
    }
    get shouldAllow() {
        return this.isAllowed && this.isDetected;
    }
    get shouldPossiblyBlock() {
        return this.isBlocked && this.isPossiblyDetected;
    }
    get shouldPossilbyAllow() {
        return this.isAllowed && this.isPossiblyDetected;
    }
}
class NavSequenceDetections {
    constructor(detected, possiblyDetected) {
        this.blockedDetected = [];
        this.blockedPossiblyDetected = [];
        this.allowedDetected = [];
        this.allowedPossiblyDetected = [];
        const isBlocked = (sequence) => {
            const metadata = sequence.metadata;
            if (maybe_none(metadata)) {
                return false;
            }
            return metadata.block;
        };
        const isAllowed = (sequence) => {
            const metadata = sequence.metadata;
            if (maybe_none(metadata)) {
                return false;
            }
            return metadata.allow;
        };
        this.blockedDetected = sortDetectedNavSequences(detected.filter(isBlocked));
        this.blockedPossiblyDetected = sortDetectedNavSequences(possiblyDetected.filter(isBlocked));
        this.allowedDetected = sortDetectedNavSequences(detected.filter(isAllowed));
        this.allowedPossiblyDetected = sortDetectedNavSequences(possiblyDetected.filter(isAllowed));
        this.action = this.resolveActions();
    }
    sortActions(actions) {
        if (isEmpty(actions)) {
            return [];
        }
        return actions.sort((a, b) => {
            const [sequenceA, blockA, detectedA] = a;
            const [sequenceB, blockB, detectedB] = b;
            const comparison = compareTrackedNavSequences(sequenceA, sequenceB);
            if (comparison === 0) {
                const isBlockedA = blockA === BlockType.block;
                const isBlockedB = blockB === BlockType.block;
                const isAllowedA = blockA === BlockType.allow;
                const isAllowedB = blockB === BlockType.allow;
                const isDetectedA = detectedA === DetectedType.detected;
                const isDetectedB = detectedB === DetectedType.detected;
                const isPossiblyDetectedA = detectedA === DetectedType.possiblyDetected;
                const isPossiblyDetectedB = detectedB === DetectedType.possiblyDetected;
                if (isDetectedA && isPossiblyDetectedB) {
                    return -1;
                }
                else if (isDetectedB && isPossiblyDetectedA) {
                    return 1;
                }
                else if (isBlockedA && isAllowedB) {
                    return -1;
                }
                else if (isBlockedB && isAllowedA) {
                    return 1;
                }
                else {
                    return compareHigher(sequenceA.length, sequenceB.length);
                }
            }
            else {
                return comparison;
            }
        });
    }
    resolveActions() {
        const actions = [];
        const maybeAddAction = (sequences, block, detected) => {
            if (!isEmpty(sequences)) {
                actions.push([first(sequences), block, detected]);
            }
        };
        maybeAddAction(this.blockedDetected, BlockType.block, DetectedType.detected);
        maybeAddAction(this.allowedDetected, BlockType.allow, DetectedType.detected);
        maybeAddAction(this.blockedPossiblyDetected, BlockType.block, DetectedType.possiblyDetected);
        maybeAddAction(this.allowedPossiblyDetected, BlockType.allow, DetectedType.possiblyDetected);
        if (isEmpty(actions)) {
            const precedence = undefined;
            return new ResolvedDetectionAction(precedence, BlockType.none, DetectedType.none);
        }
        const sortedActions = this.sortActions(actions);
        const [action, block, detected] = first(sortedActions);
        return new ResolvedDetectionAction(action.precedence, block, detected);
    }
    get precedence() {
        return this.action.precedence;
    }
    get shouldBlock() {
        return this.action.shouldBlock;
    }
    get shouldPossiblyBlock() {
        return this.action.shouldPossiblyBlock;
    }
    get shouldAllow() {
        return this.action.shouldAllow;
    }
    get shouldPossiblyAllow() {
        return this.action.shouldPossilbyAllow;
    }
    findFirstDetection(sequences) {
        if (isEmpty(sequences)) {
            return new EmptyNavSequenceDetection();
        }
        return first(sequences);
    }
    get blocked() {
        return this.findFirstDetection(this.blockedDetected);
    }
    get possibleBlocked() {
        return this.findFirstDetection(this.blockedPossiblyDetected);
    }
    get allowed() {
        return this.findFirstDetection(this.allowedDetected);
    }
    get possibleAllowed() {
        return this.findFirstDetection(this.allowedPossiblyDetected);
    }
}
class CompleteNavSequence {
    constructor(metadata) {
        this.metadata = metadata;
        this.sequence = [];
        this.backRefs = [];
    }
    push(navPattern, partialNavSequence) {
        this.sequence.push([navPattern, partialNavSequence]);
        const backRef = navPattern.asBackReference;
        if (maybe_some(backRef)) {
            this.backRefs.push([backRef, partialNavSequence]);
        }
    }
    get length() {
        return this.sequence.length;
    }
    get(index) {
        if (index < 0 || index >= this.sequence.length) {
            return undefined;
        }
        return this.sequence[index];
    }
}
function* findInclusions(length) {
    const includes = newArray(length, false);
    yield includes;
    let foundAllInclusions = false;
    while (!foundAllInclusions) {
        let carry = true;
        for (let index = 0; carry && (index < includes.length); index += 1) {
            const include = includes[index];
            if (include) {
                includes[index] = false;
                carry = true;
            }
            else {
                includes[index] = true;
                carry = false;
            }
        }
        if (carry) {
            foundAllInclusions = true;
        }
        else {
            yield includes;
        }
    }
}
function makeIndexMask(indices, length) {
    const isIndexMask = newArray(length, false);
    const indexMask = newArray(length, -1);
    for (let i = 0; i < indices.length; i += 1) {
        const index = indices[i];
        isIndexMask[index] = true;
        indexMask[index] = i;
    }
    return [isIndexMask, indexMask];
}
class NavSequenceDetector {
    constructor(navSequences) {
        this.completeNavSequenceMap = new Map();
        this.partialNavSequenceMap = new hash_map_HashMap(hashNavigation, isSameNavigation);
        this.idGenerator = new IdGenerator();
        for (const [navSequence, navMetadata] of navSequences) {
            for (const navSequenceVariation of this.findRepeatPatternVariations(navSequence)) {
                const navSequenceId = this.idGenerator.generateId();
                this.buildPartialNavSequences(navSequenceVariation, navMetadata, navSequenceId);
            }
        }
    }
    *findRepeatPatternVariations(navSequence) {
        const repeatPatternIndices = findAllIndices(navSequence, (navPattern) => {
            return navPattern.hasRepeatedModifier;
        });
        const [isRepeatPattern, includesIndex] = makeIndexMask(repeatPatternIndices, navSequence.length);
        const doInclude = (includes, index) => {
            if (isRepeatPattern[index]) {
                return includes[includesIndex[index]];
            }
            else {
                return true;
            }
        };
        for (const includes of findInclusions(repeatPatternIndices.length)) {
            const navSequenceVariation = new Array();
            for (let index = 0; index < navSequence.length; index += 1) {
                if (doInclude(includes, index)) {
                    navSequenceVariation.push(navSequence[index]);
                }
            }
            yield navSequenceVariation;
        }
    }
    emptyPartialNavSequenceSet() {
        return makeDefaultHashSet();
    }
    addPartialNavSequence(navigation, partialNavSequence) {
        const partialNavSequenceSet = this.partialNavSequenceMap.get(navigation);
        if (maybe_some(partialNavSequenceSet)) {
            partialNavSequenceSet.add(partialNavSequence);
        }
        else {
            const newPartialNavSequenceSet = this.emptyPartialNavSequenceSet();
            newPartialNavSequenceSet.add(partialNavSequence);
            this.partialNavSequenceMap.put(navigation, newPartialNavSequenceSet);
        }
    }
    addCompleteNavSequence(navPattern, partialNavSequence, navMetadata) {
        const navSequenceId = partialNavSequence.navSequenceId;
        const completeNavSequence = this.completeNavSequenceMap.get(navSequenceId);
        if (maybe_some(completeNavSequence)) {
            completeNavSequence.push(navPattern, partialNavSequence);
        }
        else {
            const newCompleteNavSequence = new CompleteNavSequence(navMetadata);
            newCompleteNavSequence.push(navPattern, partialNavSequence);
            this.completeNavSequenceMap.set(navSequenceId, newCompleteNavSequence);
        }
    }
    buildPartialNavSequences(navSequence, navMetadata, navSequenceId) {
        const completeLength = navSequence.length;
        navSequence.forEach((navPattern, index) => {
            const id = navPattern.id;
            const partialLength = index + 1;
            const partialNavSequence = new PartialNavSequence(navSequenceId, id, partialLength, completeLength);
            this.addCompleteNavSequence(navPattern, partialNavSequence, navMetadata);
            for (const navigation of navPattern.buildNavigations()) {
                this.addPartialNavSequence(navigation, partialNavSequence);
            }
        });
    }
    findNextInCompleteNavSequence(partialNavSequence) {
        if (partialNavSequence.isComplete) {
            return undefined;
        }
        const navSequenceId = partialNavSequence.navSequenceId;
        const completeNavSequence = this.completeNavSequenceMap.get(navSequenceId);
        if (maybe_none(completeNavSequence)) {
            return undefined;
        }
        const nextIndex = partialNavSequence.asNextIndex;
        if (maybe_none(nextIndex)) {
            return undefined;
        }
        const nextInSequence = completeNavSequence.get(nextIndex);
        return nextInSequence;
    }
    findNextInNavSequenceWithRepeated(partialNavSequence, nextPartialNavSequenceSet) {
        if (partialNavSequence.isComplete) {
            return undefined;
        }
        const navSequenceId = partialNavSequence.navSequenceId;
        const completeNavSequence = this.completeNavSequenceMap.get(navSequenceId);
        if (maybe_none(completeNavSequence)) {
            return undefined;
        }
        const nextIndex = partialNavSequence.asNextIndex;
        if (maybe_some(nextIndex)) {
            const nextPossible = completeNavSequence.get(nextIndex);
            if (maybe_some(nextPossible)) {
                const [, nextPartialNavSequence] = nextPossible;
                if (nextPartialNavSequenceSet.has(nextPartialNavSequence)) {
                    return nextPartialNavSequence;
                }
            }
        }
        const currentIndex = partialNavSequence.asIndex;
        const currentSequence = completeNavSequence.get(currentIndex);
        if (maybe_some(currentSequence)) {
            const [currentNavPattern, currentPartialNavSequence] = currentSequence;
            if (currentNavPattern.hasRepeatedModifier && nextPartialNavSequenceSet.has(currentPartialNavSequence)) {
                return currentPartialNavSequence;
            }
        }
        return undefined;
    }
    *findNextInNavSequences(currentPartialNavSequenceResultMap, nextPartialNavSequenceSet, navData) {
        for (const [partialNavSequence, trackedNavSequence] of currentPartialNavSequenceResultMap) {
            const nextPartialNavSequence = this.findNextInNavSequenceWithRepeated(partialNavSequence, nextPartialNavSequenceSet);
            if (maybe_some(nextPartialNavSequence)) {
                trackedNavSequence.push(navData, nextPartialNavSequence);
                yield [nextPartialNavSequence, trackedNavSequence];
            }
        }
    }
    findNavMetadata(navSequenceId) {
        const completeNavSequence = this.completeNavSequenceMap.get(navSequenceId);
        if (maybe_none(completeNavSequence)) {
            return undefined;
        }
        return completeNavSequence.metadata;
    }
    *findFirstInNavSequences(partialNavSequenceSet, navData) {
        yield* map(filter(partialNavSequenceSet, (partialNavSequence) => {
            return (partialNavSequence.partialLength === 1);
        }), (partialNavSequence) => {
            const navSequenceId = partialNavSequence.navSequenceId;
            const metadata = this.findNavMetadata(navSequenceId);
            const trackedNavSequence = new TrackedNavSequence(metadata);
            trackedNavSequence.push(navData, partialNavSequence);
            return [partialNavSequence, trackedNavSequence];
        });
    }
    findPartialNavSequenceSet(navigation) {
        if (maybe_none(navigation)) {
            return this.emptyPartialNavSequenceSet();
        }
        const partialNavSequenceSet = this.partialNavSequenceMap.get(navigation);
        if (maybe_none(partialNavSequenceSet)) {
            return this.emptyPartialNavSequenceSet();
        }
        return partialNavSequenceSet;
    }
    findOriginPartialNavSequenceSet(navData) {
        if (maybe_some(navData.origin)) {
            const navigation = new OriginNav(navData.type, navData.origin);
            return this.findPartialNavSequenceSet(navigation);
        }
        return this.emptyPartialNavSequenceSet();
    }
    findCategorizedPartialNavSequenceSet(navData) {
        const set = this.emptyPartialNavSequenceSet();
        for (const category of urlCategoryValues) {
            let navigation;
            if ((navData.categories & category) !== 0) {
                navigation = new CategorizedNav(navData.type, category);
            }
            else {
                navigation = new CategorizedNotNav(navData.type, category);
            }
            set.addMany(this.findPartialNavSequenceSet(navigation));
        }
        return set;
    }
    findGroupPartialNavSequenceSet(navData) {
        if (maybe_none(navData.groups)) {
            return this.emptyPartialNavSequenceSet();
        }
        const groupPartialNavSequenceSet = this.emptyPartialNavSequenceSet();
        for (const group of navData.groups) {
            const navigation = new GroupNav(navData.type, group);
            groupPartialNavSequenceSet.addMany(this.findPartialNavSequenceSet(navigation));
        }
        return groupPartialNavSequenceSet;
    }
    *findBackRefPartialNavSequences(navData, currentPartialNavSequence, trackedNavSequence) {
        const navSequenceId = currentPartialNavSequence.navSequenceId;
        const completeNavSequence = this.completeNavSequenceMap.get(navSequenceId);
        if (maybe_none(completeNavSequence)) {
            return;
        }
        for (const [backRefNavPattern, nextPartialNavSequence] of completeNavSequence.backRefs) {
            const backRefNavData = trackedNavSequence.lookupBackRefBinding(backRefNavPattern.backRef);
            for (const navType of backRefNavPattern.navTypes()) {
                const hasSameNavType = (navData.type === navType);
                const hasSameOrigin = (maybe_some(backRefNavData) && origin_isSameOrigin(navData.origin, backRefNavData.origin));
                if (backRefNavPattern.hasNotModifer) {
                    if (hasSameNavType && maybe_some(backRefNavData) && !hasSameOrigin) {
                        yield nextPartialNavSequence;
                    }
                }
                else {
                    if (hasSameNavType && maybe_some(backRefNavData) && hasSameOrigin) {
                        yield nextPartialNavSequence;
                    }
                }
            }
        }
    }
    findBackRefPartialNavSequenceSet(navData, currentPartialNavSequenceResultMap) {
        const nextPartialNavSequenceSet = this.emptyPartialNavSequenceSet();
        for (const [currentPartialNavSequence, trackedNavSequence] of currentPartialNavSequenceResultMap) {
            nextPartialNavSequenceSet.addMany(this.findBackRefPartialNavSequences(navData, currentPartialNavSequence, trackedNavSequence));
        }
        return nextPartialNavSequenceSet;
    }
    detectNavSequence(navData, currentPartialNavSequenceResultMap) {
        if (navData.type === NavType.contentType) {
            return this.detectNavSequenceWithContentType(navData, currentPartialNavSequenceResultMap);
        }
        const nextPartialNavSequenceSet = this.emptyPartialNavSequenceSet();
        nextPartialNavSequenceSet.addMany(this.findOriginPartialNavSequenceSet(navData));
        nextPartialNavSequenceSet.addMany(this.findCategorizedPartialNavSequenceSet(navData));
        nextPartialNavSequenceSet.addMany(this.findGroupPartialNavSequenceSet(navData));
        nextPartialNavSequenceSet.addMany(this.findBackRefPartialNavSequenceSet(navData, currentPartialNavSequenceResultMap));
        const nextPartialNavSequenceResultMap = makeDefaultHashMap();
        nextPartialNavSequenceResultMap.putMany(this.findFirstInNavSequences(nextPartialNavSequenceSet, navData));
        nextPartialNavSequenceResultMap.putMany(this.findNextInNavSequences(currentPartialNavSequenceResultMap, nextPartialNavSequenceSet, navData));
        return nextPartialNavSequenceResultMap;
    }
    findContentType(navigation) {
        if (maybe_none(navigation.asContentType)) {
            return undefined;
        }
        return navigation.asContentType.contentType;
    }
    findNextInNavSequenceWithContentType(currentPartialNavSequence, trackedNavSequence, navData) {
        const nextInSequence = this.findNextInCompleteNavSequence(currentPartialNavSequence);
        if (maybe_none(nextInSequence)) {
            return undefined;
        }
        const [nextNavigation, nextPartialNavSequence] = nextInSequence;
        const nextContentType = this.findContentType(nextNavigation);
        if (maybe_none(nextContentType)) {
            return [currentPartialNavSequence, trackedNavSequence];
        }
        const contentType = navData.contentType;
        if (maybe_none(contentType)) {
            return undefined;
        }
        if (contentType === nextContentType) {
            trackedNavSequence.push(navData, nextPartialNavSequence);
            return [nextPartialNavSequence, trackedNavSequence];
        }
        return undefined;
    }
    *findNextInNavSequencesWithContentType(navData, currentPartialNavSequenceResultMap) {
        for (const [currentPartialNavSequence, trackedNavSequence] of currentPartialNavSequenceResultMap) {
            const nextInSequence = this.findNextInNavSequenceWithContentType(currentPartialNavSequence, trackedNavSequence, navData);
            if (maybe_some(nextInSequence)) {
                yield nextInSequence;
            }
        }
    }
    detectNavSequenceWithContentType(navData, currentPartialNavSequenceResultMap) {
        const nextPartialNavSequenceResultMap = makeDefaultHashMap();
        nextPartialNavSequenceResultMap.putMany(this.findNextInNavSequencesWithContentType(navData, currentPartialNavSequenceResultMap));
        return nextPartialNavSequenceResultMap;
    }
}
class TabNavSequence {
    constructor(tabId) {
        this.tabId = tabId;
        this.currentNavSequence = new Array();
        this.navListeners = new Array();
    }
    onParentTab(timeStamp, url, origin, categories, groups) {
        const navigation = new NavData(NavType.parentTab, timeStamp, url, origin, categories, groups);
        this.onNavigation(navigation);
    }
    onNavigate(timeStamp, url, origin, categories, groups, isNewTab, didUserCreateTab, isFreshNavSeq) {
        if (isFreshNavSeq) {
            this.currentNavSequence = [];
        }
        const navigation = new NavData(NavType.navigation, timeStamp, url, origin, categories, groups);
        navigation.isNewTab = isNewTab;
        navigation.didUserCreateTab = didUserCreateTab;
        this.onNavigation(navigation);
    }
    onRedirect(timeStamp, url, origin, categories, groups) {
        const navigation = new NavData(NavType.redirect, timeStamp, url, origin, categories, groups);
        this.onNavigation(navigation);
    }
    onContentType(timeStamp, url, origin, categories, groups, contentType) {
        const navigation = new NavData(NavType.contentType, timeStamp, url, origin, categories, groups);
        navigation.contentType = contentType;
        this.onNavigation(navigation);
    }
    onNavigation(navigation) {
        this.currentNavSequence.push(navigation);
        this.notifyListeners(navigation);
    }
    notifyListeners(navigation) {
        for (const onNavigation of this.navListeners) {
            onNavigation(navigation);
        }
    }
    addListener(onNavigation) {
        for (const navigation of this.currentNavSequence) {
            onNavigation(navigation);
        }
        this.navListeners.push(onNavigation);
    }
    get isNewTab() {
        return isEmpty(this.currentNavSequence);
    }
    get currentNavSeq() {
        return this.currentNavSequence;
    }
    reset() {
        this.currentNavSequence = [];
    }
}
class TabNavSequenceDetector {
    constructor(tabId, tabNavSequence, navSequenceDetector) {
        this.tabId = tabId;
        this.navSequenceDetector = navSequenceDetector;
        this.partialNavSequenceResultMap = makeDefaultHashMap();
        this.navigationCount = 0;
        tabNavSequence.addListener((navigation) => this.onNavigation(navigation));
    }
    onNavigation(navigation) {
        const isParentTab = (navigation.type === NavType.parentTab);
        const isFirstNavigation = (this.navigationCount === 0);
        if (isParentTab && !isFirstNavigation) {
            return;
        }
        this.navigationCount += 1;
        this.partialNavSequenceResultMap = this.detectNavSequence(navigation);
    }
    detectNavSequence(navigation) {
        return this.navSequenceDetector.detectNavSequence(navigation, this.partialNavSequenceResultMap);
    }
    findDetectedNavSequences(doIncludeNavSequence) {
        const detectedNavSequences = [];
        for (const [partialNavSequence, trackedNavSequence] of this.partialNavSequenceResultMap) {
            if (doIncludeNavSequence(partialNavSequence)) {
                detectedNavSequences.push(trackedNavSequence);
            }
        }
        return detectedNavSequences;
    }
    get detectedNavSequences() {
        return this.findDetectedNavSequences((partialNavSequence) => {
            return partialNavSequence.isComplete;
        });
    }
    get possiblyDetectedNavSequences() {
        return this.findDetectedNavSequences((partialNavSequence) => {
            return partialNavSequence.isPartial;
        });
    }
    reset() {
        this.partialNavSequenceResultMap = makeDefaultHashMap();
        this.navigationCount = 0;
    }
}
class PhishingNavSequenceDetector {
    constructor(configNotifier, tabClosedDispatcher) {
        this.tabNavSequences = new Map();
        this.tabNavSequenceDetectors = new Map();
        this.builtinRulesPrecedence = undefined;
        this.phishingNavSeqVersion = StaticConfig.phishingNavigationSequencesVersion;
        this.updateNavSequenceDetector(defaultRules);
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        tabClosedDispatcher.registerOnTabClosedHandler(this.onTabClosed.bind(this));
    }
    updateNavSequenceDetector(serializedPhishingNavSeqData) {
        let phishingNavSeqData = parseSerializedPhishingNavSeqData(serializedPhishingNavSeqData, this.phishingNavSeqVersion);
        if (maybe_none(phishingNavSeqData)) {
            phishingNavSeqData = parseSerializedPhishingNavSeqData(defaultRules, this.phishingNavSeqVersion);
            if (maybe_none(phishingNavSeqData)) {
                logError("Failed to parse default nav seq rules! The nav sequence detector won't function");
                return;
            }
        }
        this.builtinRulesPrecedence = phishingNavSeqData.builtinRulesPrecedence;
        const navSequenceDetector = new NavSequenceDetector(phishingNavSeqData.phishingNavSeqs);
        this.tabNavSequenceDetectors = this.makeTabNavSequenceDetectors(navSequenceDetector);
        this.navSequenceDetector = navSequenceDetector;
    }
    makeTabNavSequenceDetectors(navSequenceDetector) {
        const tabNavSequenceDetectors = new Map();
        this.tabNavSequences.forEach((tabNavSequence, tabId) => {
            const tabNavSequenceDetector = new TabNavSequenceDetector(tabId, tabNavSequence, navSequenceDetector);
            tabNavSequenceDetectors.set(tabId, tabNavSequenceDetector);
        });
        return tabNavSequenceDetectors;
    }
    onConfigChanged(config) {
        if (maybe_some(config.phishingNavigationSequences)) {
            this.updateNavSequenceDetector(config.phishingNavigationSequences);
        }
    }
    onTabClosed(tabId) {
        this.tabNavSequenceDetectors.delete(tabId);
        this.tabNavSequences.delete(tabId);
    }
    onNewTab(tabId) {
        const tabNavSequence = new TabNavSequence(tabId);
        this.tabNavSequences.set(tabId, tabNavSequence);
        if (maybe_some(this.navSequenceDetector)) {
            const tabNavSequenceDetector = new TabNavSequenceDetector(tabId, tabNavSequence, this.navSequenceDetector);
            this.tabNavSequenceDetectors.set(tabId, tabNavSequenceDetector);
        }
    }
    hasHigherPrecedenceThanBuiltin(navSequenceDetections) {
        if (maybe_none(this.builtinRulesPrecedence) ||
            maybe_none(navSequenceDetections.precedence)) {
            return false;
        }
        return navSequenceDetections.precedence > this.builtinRulesPrecedence;
    }
    resetDetector(tabId) {
        const tabNavSequence = this.tabNavSequences.get(tabId);
        if (maybe_some(tabNavSequence)) {
            tabNavSequence.reset();
        }
        const tabNavSequenceDetector = this.tabNavSequenceDetectors.get(tabId);
        if (maybe_some(tabNavSequenceDetector)) {
            tabNavSequenceDetector.reset();
        }
    }
    onTabDetected(tabId) {
        if (this.tabNavSequences.has(tabId)) {
            return;
        }
        this.onNewTab(tabId);
    }
    onParentTabDetected(tabId, timeStamp, url, categories, groups) {
        const tabNavSequence = this.tabNavSequences.get(tabId);
        if (maybe_none(tabNavSequence)) {
            return false;
        }
        if (!tabNavSequence.isNewTab) {
            return false;
        }
        const origin = origin_parseOrigin(url);
        if (maybe_none(origin)) {
            return false;
        }
        tabNavSequence.onParentTab(timeStamp, url, origin, categories, groups);
        return true;
    }
    parseOriginForBrowser(url) {
        switch (currentBrowser) {
            case Browser.chrome:
                return origin_parseOrigin(url, new OriginParseOptions({
                    allowChromeScheme: true,
                    allowChromeExtensionScheme: true,
                }));
            case Browser.firefox:
                return origin_parseOrigin(url, new OriginParseOptions({
                    allowAboutScheme: true,
                    allowFirefoxExtensionScheme: true,
                }));
            case Browser.edgeChromium:
                return origin_parseOrigin(url, new OriginParseOptions({
                    allowEdgeScheme: true,
                    allowChromeScheme: true,
                    allowChromeExtensionScheme: true,
                }));
            default:
                logError("Current browser unknown in NavSequenceDetector.parseOriginForBrowser");
                return origin_parseOrigin(url, new OriginParseOptions());
        }
    }
    onEvent(tabId, url, handleEvent) {
        const tabNavSequence = this.tabNavSequences.get(tabId);
        if (maybe_none(tabNavSequence)) {
            return new EmptyNavSequenceDetections();
        }
        const origin = this.parseOriginForBrowser(url);
        handleEvent(tabNavSequence, url, origin);
        const tabNavSequenceDetector = this.tabNavSequenceDetectors.get(tabId);
        if (maybe_none(tabNavSequenceDetector)) {
            return new EmptyNavSequenceDetections();
        }
        return new NavSequenceDetections(tabNavSequenceDetector.detectedNavSequences, tabNavSequenceDetector.possiblyDetectedNavSequences);
    }
    onNavigate(tabId, timeStamp, url, categories, groups, isNewTab, didUserCreateTab, isFreshNavSeq) {
        return this.onEvent(tabId, url, (tabNavSequence, url, origin) => {
            tabNavSequence.onNavigate(timeStamp, url, origin, categories, groups, isNewTab, didUserCreateTab, isFreshNavSeq);
        });
    }
    onRedirect(tabId, timeStamp, url, categories, groups) {
        return this.onEvent(tabId, url, (tabNavSequence, url, origin) => {
            tabNavSequence.onRedirect(timeStamp, url, origin, categories, groups);
        });
    }
    onContentType(tabId, timeStamp, url, categories, groups, contentType) {
        return this.onEvent(tabId, url, (tabNavSequence, url, origin) => {
            tabNavSequence.onContentType(timeStamp, url, origin, categories, groups, contentType);
        });
    }
    getTabCurrentNavSeq(tabId) {
        var _a;
        return (_a = this.tabNavSequences.get(tabId)) === null || _a === void 0 ? void 0 : _a.currentNavSeq;
    }
}
function compareHigher(a, b) {
    if (a > b) {
        return -1;
    }
    else if (a < b) {
        return 1;
    }
    else {
        return 0;
    }
}
function compareTrackedNavSequences(a, b) {
    const aPrecedence = a.precedence;
    const bPrecedence = b.precedence;
    if (maybe_none(aPrecedence) || maybe_none(bPrecedence)) {
        return 0;
    }
    return compareHigher(aPrecedence, bPrecedence);
}
function sortDetectedNavSequences(detectedNavSequences) {
    if (isEmpty(detectedNavSequences)) {
        return [];
    }
    return detectedNavSequences.sort(compareTrackedNavSequences);
}

;// CONCATENATED MODULE: ./new-tab-page-url-tracker.ts




class NewTabPageUrlTracker {
    constructor(configNotifier) {
        this.newTabPageUrls = new Map();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        this.updateNewTabPageUrls(config.newTabPageUrls);
    }
    isNewTabPageUrl(url) {
        if (maybe_none(currentBrowser)) {
            return false;
        }
        const urls = this.newTabPageUrls.get(currentBrowser);
        if (maybe_none(urls)) {
            return false;
        }
        return urls.has(url);
    }
    updateNewTabPageUrls(serializedNewTabPageUrls) {
        if (maybe_none(serializedNewTabPageUrls)) {
            this.newTabPageUrls = new Map();
            return;
        }
        this.newTabPageUrls = new Map();
        const updateBrowserNewTabPageUrls = (browser, specs) => {
            const urls = makeUrlHashSet(UrlCompareOptions.IgnoreSearchParams);
            urls.addMany(specs.map(url_utils_parseUrl).filter(maybe_some));
            this.newTabPageUrls.set(browser, urls);
        };
        updateBrowserNewTabPageUrls(Browser.chrome, serializedNewTabPageUrls.chrome);
        updateBrowserNewTabPageUrls(Browser.firefox, serializedNewTabPageUrls.firefox);
        updateBrowserNewTabPageUrls(Browser.edgeChromium, serializedNewTabPageUrls.edgeChromium);
    }
}

;// CONCATENATED MODULE: ./options-page-controller.ts










class OptionsPageController {
    constructor(port, data, hostHelperMessageSender, onConfigured, onHostnameStatusChanged, onDisconnect) {
        this.data = data;
        this.pagePortController = new PagePortController(chrome.tabs.TAB_ID_NONE, port, port => this.sendOptionsData(), onDisconnect, hostHelperMessageSender, onConfigured);
        this.pagePortController.registerMessagePayloadHandler(MessageType.phishingHostStatusChangeV22, payload => {
            onHostnameStatusChanged(payload.hostnames, payload.allowInput);
        });
        this.pagePortController.connect();
    }
    updateData(newData) {
        this.data = newData;
        this.sendOptionsData();
    }
    sendOptionsData() {
        this.pagePortController.sendMessage(MessageType.optionsDataResponseV22, this.data);
    }
}
class OptionsController {
    constructor(configNotifier, errorHandler, categoryTracker, hostHelperMessageSender, onConfigured) {
        this.categoryTracker = categoryTracker;
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.onConfigured = onConfigured;
        this.isDormant = false;
        this.optionsPageControllers = new Map();
        this.idGenerator = new IdGenerator();
        configNotifier.addConfigListenerForKey(config => {
            this.ipConfig = config.identityProtection.config;
            this.updateOptionsData();
        }, ConfigKey.config);
        errorHandler.onDormantStateChanged.registerEventHandler(state => {
            this.isDormant = state.isDormant;
            this.updateOptionsData();
        });
        this.portResolver = new PortResolver(hostConstants.optionsPortName, port => this.onUnresolvedPortConnected(port));
    }
    updateOptionsData() {
        for (const controller of this.optionsPageControllers.values()) {
            controller.updateData(this.optionsData());
        }
    }
    makeNewPageController(port) {
        const id = this.idGenerator.generateId();
        const controller = new OptionsPageController(port, this.optionsData(), this.hostHelperMessageSender, this.onConfigured, (hostnames, allowInput) => this.onHostnameStatusChanged(hostnames, allowInput), () => this.onPortDisconnected(id));
        this.optionsPageControllers.set(id, controller);
    }
    onPortDisconnected(id) {
        this.optionsPageControllers.delete(id);
    }
    onHostnameStatusChanged(hostnames, allowInput) {
        if (allowInput) {
            this.categoryTracker.userAllowHostnames(hostnames);
        }
        else {
            this.categoryTracker.userDisallowHostnames(hostnames);
        }
    }
    onUnresolvedPortConnected(port) {
        log_log("OptionsController: options page port connected");
        this.makeNewPageController(makePromise(() => port));
    }
    optionsData() {
        let ipShowList, ipUserAllowedHosts;
        if (!this.isDormant && maybe_some(this.ipConfig)) {
            ipShowList = this.ipConfig.allowUserToEnableInput && isInputAllowableOpMode(this.ipConfig.operationMode);
            ipUserAllowedHosts = this.ipConfig.userAllowedHosts;
        }
        else {
            ipShowList = false;
            ipUserAllowedHosts = [];
        }
        return { ipShowList, ipUserAllowedHosts };
    }
}

;// CONCATENATED MODULE: ./popup-page-controller.ts














class PopupPageController {
    constructor(port, onDisconnect, hostHelperMessageSender, browserLauncher, isFullyConfigured, response) {
        this.browserLauncher = browserLauncher;
        this.isFullyConfigured = isFullyConfigured;
        this.response = response;
        this.connected = false;
        this.pagePortController = new PagePortController(chrome.tabs.TAB_ID_NONE, port, () => { this.connected = true; }, onDisconnect, hostHelperMessageSender);
        this.pagePortController.registerMessagePayloadHandler(MessageType.popupDataRequestV1, (message) => this.handlePopupDataRequest(message));
        this.pagePortController.forwardMessageTypeToHelper(MessageType.clearRememberedDecisionsV1);
        this.pagePortController.registerMessagePayloadHandler(MessageType.launchBrowserRequestV1, (message) => this.launchSecureBrowser(message));
        this.pagePortController.connect();
    }
    launchSecureBrowser(launchRequest) {
        this.browserLauncher.launchBrowser(launchRequest.urlSpec);
    }
    updatePopupData(isFullyConfigured, response) {
        this.isFullyConfigured = isFullyConfigured;
        this.response = response;
        this.sendPopupDataResponse();
    }
    sendPopupDataResponse() {
        if (!this.connected || !this.isFullyConfigured) {
            return;
        }
        this.pagePortController.sendMessage(MessageType.popupDataResponseV25, this.response);
    }
    handlePopupDataRequest(request) {
        this.sendPopupDataResponse();
    }
}
class PopupController {
    constructor(hostHelperMessageSender, browserLauncher, configNotifier, brandingManager, featureManager, handshaker, onConfigured) {
        this.hostHelperMessageSender = hostHelperMessageSender;
        this.browserLauncher = browserLauncher;
        this.featureManager = featureManager;
        this.currentPopupMessage = I18nMessages.popupNoError;
        this.openPhishingLinksInSecureBrowser = false;
        this.isFullyConfigured = false;
        this.isEnterpriseProduct = false;
        this.isFullyVirtualisedFirefox = false;
        this.isSecureBrowser = false;
        this.ipEnabled = false;
        this.sbxEnabled = true;
        this.productType = ProductTypes.Unknown;
        this.popupPageControllers = new Map();
        this.idGenerator = new IdGenerator();
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        this.portResolver = new PortResolver(hostConstants.popupPortName, port => this.onUnresolvedPortConnected(port));
        const port = this.portResolver.resolvePort();
        brandingManager.onPopupDataChanged.registerEventHandler(message => this.onPopupDataChanged(message));
        if (handshaker.isHandshaken && maybe_some(handshaker.negotiatedVersion)) {
            this.onHandshaken(handshaker.negotiatedVersion);
        }
        else {
            handshaker.onHandshaken.registerEventHandler(event => this.onHandshaken(event.negotiatedVersion));
        }
        onConfigured.registerListener(() => this.onConfigured());
        this.makeNewPageController(port);
    }
    onHandshaken(negotiatedVersion) {
        this.negotiatedVersion = negotiatedVersion;
        this.updatePopupData();
    }
    onConfigured() {
        this.isFullyConfigured = true;
        this.updatePopupData();
    }
    onConfigChanged(config) {
        this.openPhishingLinksInSecureBrowser = config.openPhishingLinksInSecureBrowser;
        this.isEnterpriseProduct = config.isEnterpriseProduct;
        this.productType = config.productType;
        this.isFullyVirtualisedFirefox = config.isFullyVirtualisedFirefox;
        this.isSecureBrowser = config.sbxSecureBrowserMode;
        this.ipEnabled = config.ipEnabled;
        this.sbxEnabled = config.sbxEnabled;
        this.updatePopupData();
    }
    onPopupDataChanged(newPopupMessage) {
        if (this.currentPopupMessage !== newPopupMessage) {
            log_log(`Setting popup message to internationalised string ${newPopupMessage}`);
            this.currentPopupMessage = newPopupMessage;
            this.updatePopupData();
        }
    }
    makePopupData() {
        return new PopupDataResponseV25(this.currentPopupMessage, this.showClearRememberedDecisionsInfo, this.showSecureBrowserWindowButton, this.productType, this.helpLinkURL);
    }
    updatePopupData() {
        for (const [_, controller] of this.popupPageControllers) {
            controller.updatePopupData(this.isFullyConfigured, this.makePopupData());
        }
    }
    makeNewPageController(port, expected = true) {
        const id = this.idGenerator.generateId();
        const controller = new PopupPageController(port, () => { expected ? this.onPortDisconnected(id) : this.onUnexpectedPortDisconnected(id); }, this.hostHelperMessageSender, this.browserLauncher, this.isFullyConfigured, this.makePopupData());
        this.popupPageControllers.set(id, controller);
    }
    onPortDisconnected(id) {
        this.popupPageControllers.delete(id);
        const port = this.portResolver.resolvePort();
        this.makeNewPageController(port);
    }
    onUnexpectedPortDisconnected(id) {
        this.popupPageControllers.delete(id);
    }
    onUnresolvedPortConnected(port) {
        log_log("PopupController: unexpected port connected. There's probably multiple popup pages");
        this.makeNewPageController(makePromise(() => port), false);
    }
    get helpLinkURL() {
        if (this.isFullyVirtualisedFirefox) {
            return undefined;
        }
        if (this.isSecureBrowser && !this.ipEnabled) {
            return undefined;
        }
        const locale = getI18n(I18nMessages.helpLinkLocale);
        const version = getHelpPageVersion(this.negotiatedVersion);
        if (has([HelpPageVersion.v415, HelpPageVersion.v4181, HelpPageVersion.v430], version)) {
            return this.makeOldStyleHelpLink(locale, version);
        }
        else {
            return this.makeHelpLink(locale, version);
        }
    }
    makeHelpLink(locale, version) {
        let filename = "secure-browsing";
        if (this.ipEnabled) {
            filename = this.sbxEnabled ? "secure-browsing-credential-protection" : "credential-protection";
        }
        if (this.isEnterpriseProduct) {
            filename += "-enterprise";
        }
        return `https://hpwolfsecurity-help.hpwolf.com/extension/${version}/${locale}/${filename}.html`;
    }
    makeOldStyleHelpLink(locale, version) {
        const hostname = this.isEnterpriseProduct ? sureClickAdvancedHelpHostname : sureClickHelpHostname;
        let features = "secure-browsing";
        if (this.ipEnabled) {
            features = this.sbxEnabled ? "secure-browsing-identity-protection" : "identity-protection";
        }
        return `${hostname}/${features}/${version}/${locale}/secure-browsing.html`;
    }
    get showClearRememberedDecisionsInfo() {
        if (this.openPhishingLinksInSecureBrowser) {
            return false;
        }
        return this.featureManager.isLinkProtectionEnabled || this.featureManager.isPDFProtectionEnabled;
    }
    get showSecureBrowserWindowButton() {
        return this.sbxEnabled;
    }
}

;// CONCATENATED MODULE: ./tab-stalker.ts







function parseTabUrl(tab) {
    if (tab.url === undefined) {
        return undefined;
    }
    const spec = tab.url;
    const url = url_utils_parseUrl(spec);
    if (url === undefined) {
        return spec;
    }
    else {
        return url;
    }
}
class TabStalkerState {
    constructor() {
        this.windows = new Set();
        this.tabs = new Set();
        this.windowsToTabs = new Map();
        this.tabsToWindows = new Map();
        this.tabURLs = new Map();
        this.windowActivatedTabs = new Map();
        this.windowLastUniqueActivatedTabs = new Map();
        this.activatedTabs = new Set();
        this.openerTabs = new Map();
        this.openerWindows = new Map();
        this.restoredSessionTabs = new Set();
    }
}
class TabStalker {
    constructor() {
        this.state = new TabStalkerState();
        this.onTabActivatedHandlers = [];
        this.onTabClosedHandlers = [];
        this.onTabRestoredListeners = [];
        this.onTabUpdatedHandlers = [];
        this.tabListenerManager = new ApiListenerManager();
        this.windowListenerManager = new ApiListenerManager();
        this.browserNewTabURLs = parseTabsAPIBrowserNewTabURLs();
        this.tabListenerManager.addEvent('tabs.onCreated', chrome.tabs.onCreated, this.onTabCreated.bind(this));
        this.tabListenerManager.addEvent('tabs.onUpdated', chrome.tabs.onUpdated, this.onTabUpdated.bind(this));
        this.tabListenerManager.addEvent('tabs.onMoved', chrome.tabs.onMoved, this.onTabMoved.bind(this));
        this.tabListenerManager.addEvent('tabs.onActivated', chrome.tabs.onActivated, this.onTabActivated.bind(this));
        this.tabListenerManager.addEvent('tabs.onHighlighted', chrome.tabs.onHighlighted, this.onTabHighlighted.bind(this));
        this.tabListenerManager.addEvent('tabs.onDetached', chrome.tabs.onDetached, this.onTabDetached.bind(this));
        this.tabListenerManager.addEvent('tabs.onAttached', chrome.tabs.onAttached, this.onTabAttached.bind(this));
        this.tabListenerManager.addEvent('tabs.onRemoved', chrome.tabs.onRemoved, this.onTabRemoved.bind(this));
        this.tabListenerManager.addEvent('tabs.onReplaced', chrome.tabs.onReplaced, this.onTabReplaced.bind(this));
        this.windowListenerManager.addEvent('windows.onCreated', chrome.windows.onCreated, this.onWindowCreated.bind(this));
        this.windowListenerManager.addEvent('windows.onRemoved', chrome.windows.onRemoved, this.onWindowRemoved.bind(this));
        this.windowListenerManager.addEvent('windows.onFocusChanged', chrome.windows.onFocusChanged, this.onWindowFocusChanged.bind(this));
    }
    queryRestoredSessionTabs() {
        chrome.windows.getAll((windows) => {
            for (const window of windows) {
                this.onWindowCreated(window);
            }
            chrome.tabs.query({}, (tabs) => {
                for (const tab of tabs) {
                    this.onTabCreated(tab);
                    const tabId = tab.id;
                    if (maybe_some(tabId)) {
                        this.restoredSessionTabs.add(tabId);
                        const url = maybe_some(tab.url) ? url_utils_parseUrl(tab.url) : undefined;
                        this.notifyOnTabRestoredListeners(tabId, url);
                    }
                }
            });
        });
    }
    onTabCreated(tab) {
        const tabId = tab.id;
        if (tabId === undefined) {
            return;
        }
        if (!isValidTabId(tabId)) {
            return;
        }
        const windowId = tab.windowId;
        this.tabs.add(tabId);
        this.addTabToWindow(tabId, windowId);
        const openerTabId = tab.openerTabId;
        if (openerTabId !== undefined) {
            this.openerTabs.set(tabId, openerTabId);
        }
        if (tab.active) {
            this.updateTabActivation(tabId, windowId);
        }
        this.updateTabURL(tabId, tab);
    }
    updateTabURL(tabId, tabInfo) {
        if (tabInfo.url === undefined) {
            return;
        }
        const url = parseTabUrl(tabInfo);
        if (url === undefined) {
            return;
        }
        this.tabURLs.set(tabId, url);
    }
    onTabUpdated(tabId, changeInfo, tab) {
        if (!isValidTabId(tabId)) {
            return;
        }
        this.tabs.add(tabId);
        if (tab.active) {
            this.updateTabActivation(tabId, tab.windowId);
        }
        this.updateTabURL(tabId, changeInfo);
        this.notifyOnTabUpdatedHandlers(tabId, changeInfo, tab);
    }
    onTabMoved(tabId, moveInfo) {
    }
    onTabActivated(activeInfo) {
        const tabId = activeInfo.tabId;
        const windowId = activeInfo.windowId;
        if (this.tabs.has(tabId)) {
            this.updateTabActivation(tabId, windowId);
        }
        else {
            chrome.tabs.get(tabId, tab => this.onTabCreated(tab));
        }
        this.notifyOnTabActivatedHandlers(tabId);
    }
    updateTabActivation(tabId, windowId) {
        if (!isValidTabId(tabId)) {
            return;
        }
        if (!isValidWindowId(windowId)) {
            return;
        }
        const lastActivatedTabId = this.windowActivatedTabs.get(windowId);
        if (maybe_some(lastActivatedTabId) && lastActivatedTabId !== tabId) {
            this.windowLastUniqueActivatedTabs.set(windowId, lastActivatedTabId);
        }
        this.windowActivatedTabs.set(windowId, tabId);
        this.activatedTabs = new Set(this.windowActivatedTabs.values());
    }
    onTabHighlighted(highlightInfo) {
    }
    onTabDetached(tabId, detachInfo) {
        if (!isValidTabId(tabId)) {
            return;
        }
        const windowId = detachInfo.oldWindowId;
        if (!isValidWindowId(windowId)) {
            return;
        }
        this.removeTabFromWindow(tabId, windowId);
    }
    onTabAttached(tabId, attachInfo) {
        if (!isValidTabId(tabId)) {
            return;
        }
        const windowId = attachInfo.newWindowId;
        if (!isValidWindowId(windowId)) {
            return;
        }
        this.addTabToWindow(tabId, windowId);
    }
    removeTab(tabId) {
        this.tabs.delete(tabId);
        this.tabURLs.delete(tabId);
        this.openerTabs.delete(tabId);
        this.restoredSessionTabs.delete(tabId);
    }
    onTabRemoved(tabId, removeInfo) {
        if (!isValidTabId(tabId)) {
            return;
        }
        const windowId = removeInfo.windowId;
        if (!isValidWindowId(windowId)) {
            return;
        }
        this.notifyOnTabClosedHandlers(tabId);
        this.removeTabFromWindow(tabId, windowId);
        this.removeTab(tabId);
    }
    onTabReplaced(addedTabId, removedTabId) {
        if (this.isTab(addedTabId)) {
            const windowId = this.findTabWindowId(addedTabId);
            if (maybe_some(windowId)) {
                this.addTabToWindow(addedTabId, windowId);
            }
        }
        if (this.isTab(removedTabId)) {
            const windowId = this.findTabWindowId(removedTabId);
            if (maybe_some(windowId)) {
                this.removeTabFromWindow(removedTabId, windowId);
                this.removeTab(removedTabId);
            }
        }
    }
    onWindowCreated(window) {
        const windowId = window.id;
        if (!isValidWindowId(windowId)) {
            return;
        }
        this.windows.add(windowId);
        let focusedWindowId = this.focusedWindowId;
        if (focusedWindowId === undefined) {
            focusedWindowId = this.lastFocusedWindowId;
        }
        if (focusedWindowId !== undefined) {
            const activatedTabId = this.windowActivatedTabs.get(focusedWindowId);
            if (activatedTabId !== undefined) {
                this.openerWindows.set(windowId, [focusedWindowId, activatedTabId]);
            }
        }
    }
    onWindowRemoved(windowId) {
        if (!isValidWindowId) {
            return;
        }
        this.windows.delete(windowId);
        const tabs = this.windowsToTabs.get(windowId);
        if (tabs !== undefined) {
            for (const tabId of tabs) {
                this.removeTab(tabId);
                this.removeTabFromWindow(tabId, windowId);
            }
        }
        this.windowsToTabs.delete(windowId);
        this.windowActivatedTabs.delete(windowId);
        this.windowLastUniqueActivatedTabs.delete(windowId);
        this.openerWindows.delete(windowId);
    }
    onWindowFocusChanged(windowId) {
        if (this.focusedWindowId !== undefined) {
            this.lastFocusedWindowId = this.focusedWindowId;
        }
        if (isValidWindowId(windowId)) {
            this.focusedWindowId = windowId;
        }
        else {
            this.focusedWindowId = undefined;
        }
    }
    registerListeners() {
        this.tabListenerManager.registerListeners();
        this.windowListenerManager.registerListeners();
    }
    unregisterListeners() {
        this.tabListenerManager.unregisterListeners();
        this.windowListenerManager.unregisterListeners();
        this.clearState();
    }
    addTabToWindow(tabId, windowId) {
        const windowToTabs = this.windowsToTabs.get(windowId);
        if (windowToTabs === undefined) {
            this.windowsToTabs.set(windowId, new Set([tabId]));
        }
        else {
            windowToTabs.add(tabId);
        }
        this.tabsToWindows.set(tabId, windowId);
    }
    removeTabFromWindow(tabId, windowId) {
        const windowToTabs = this.windowsToTabs.get(windowId);
        if (windowToTabs !== undefined) {
            this.windowsToTabs.delete(tabId);
        }
        this.tabsToWindows.delete(tabId);
    }
    findActivatedTabId(windowId) {
        if (windowId === undefined) {
            return undefined;
        }
        if (!isValidWindowId(windowId)) {
            return undefined;
        }
        return this.windowActivatedTabs.get(windowId);
    }
    findLastActivatedTabId(windowId) {
        if (windowId === undefined) {
            return undefined;
        }
        if (!isValidWindowId(windowId)) {
            return undefined;
        }
        return this.windowLastUniqueActivatedTabs.get(windowId);
    }
    findTabURL(tabId) {
        if (tabId === undefined) {
            return undefined;
        }
        if (!isValidTabId(tabId)) {
            return undefined;
        }
        return this.tabURLs.get(tabId);
    }
    findOpenerTabId(tabId) {
        if (tabId === undefined) {
            return undefined;
        }
        if (!isValidTabId(tabId)) {
            return undefined;
        }
        return this.openerTabs.get(tabId);
    }
    findTabWindowId(tabId) {
        if (tabId === undefined) {
            return undefined;
        }
        if (!isValidTabId(tabId)) {
            return undefined;
        }
        return this.tabsToWindows.get(tabId);
    }
    findOpenerWindowId(windowId) {
        if (windowId === undefined) {
            return undefined;
        }
        if (!isValidWindowId(windowId)) {
            return undefined;
        }
        return this.openerWindows.get(windowId);
    }
    findWindowTabCount(windowId) {
        if (windowId === undefined) {
            return 0;
        }
        const windowToTabs = this.windowsToTabs.get(windowId);
        if (windowToTabs === undefined) {
            return 0;
        }
        return windowToTabs.size;
    }
    get maybeNewWindowId() {
        const emptyWindowIds = toArray(filter(this.windows.keys(), (windowId) => {
            return this.findWindowTabCount(windowId) === 0;
        }));
        if (emptyWindowIds.length === 1) {
            return iter_utils_first(emptyWindowIds);
        }
        else {
            return undefined;
        }
    }
    isTabActivated(tabId) {
        return this.activatedTabs.has(tabId);
    }
    get activatedTabId() {
        return this.findActivatedTabId(this.focusedWindowId);
    }
    get activatedTabURL() {
        return this.findTabURL(this.activatedTabId);
    }
    get lastActivatedTabId() {
        return this.findLastActivatedTabId(this.focusedWindowId);
    }
    get lastFocusedWindowActivatedTabId() {
        return this.findActivatedTabId(this.lastFocusedWindowId);
    }
    isTab(tabId) {
        return isValidTabId(tabId) && this.tabs.has(tabId);
    }
    isWindow(windowId) {
        return isValidWindowId(windowId) && this.windows.has(windowId);
    }
    isRestoredSessionTab(tabId) {
        return isValidTabId(tabId) && this.restoredSessionTabs.has(tabId);
    }
    findPopupWindowTabId(windowId) {
        if (!isValidWindowId(windowId)) {
            return undefined;
        }
        const tabs = this.windowsToTabs.get(windowId);
        if (maybe_none(tabs) || (tabs.size !== 1)) {
            return undefined;
        }
        return iter_utils_first(tabs);
    }
    findBrowserNewTabURLs() {
        if (maybe_none(currentBrowser)) {
            return undefined;
        }
        const browserNewTabURL = this.browserNewTabURLs.get(currentBrowser);
        return browserNewTabURL;
    }
    didUserCreateTab(tabId) {
        const urlOrSpec = this.findTabURL(tabId);
        if (maybe_none(urlOrSpec)) {
            return false;
        }
        const url = parseURLIfNecessary(urlOrSpec);
        if (maybe_none(url)) {
            return false;
        }
        const browserNewTabURLs = this.findBrowserNewTabURLs();
        if (maybe_none(browserNewTabURLs)) {
            return false;
        }
        return browserNewTabURLs.some(newTabURL => url_utils_isSameUrl(url, newTabURL, UrlCompareOptions.IgnoreSearchParams));
    }
    registerOnTabActivatedHandler(handler) {
        this.onTabActivatedHandlers.push(handler);
    }
    notifyOnTabActivatedHandlers(tabId) {
        for (const onTabActivated of this.onTabActivatedHandlers) {
            onTabActivated(tabId);
        }
    }
    registerOnTabClosedHandler(handler) {
        this.onTabClosedHandlers.push(handler);
    }
    notifyOnTabClosedHandlers(tabId) {
        for (const onTabClosed of this.onTabClosedHandlers) {
            onTabClosed(tabId);
        }
    }
    registerOnTabRestoredListeners(listener) {
        this.onTabRestoredListeners.push(listener);
        if (!iter_utils_isEmpty(this.restoredSessionTabs)) {
            for (const tabId of this.restoredSessionTabs) {
                const urlOrSpec = this.findTabURL(tabId);
                const url = maybe_some(urlOrSpec) ? parseURLIfNecessary(urlOrSpec) : undefined;
                this.notifyOnTabRestoredListeners(tabId, url);
            }
        }
    }
    notifyOnTabRestoredListeners(tabId, url) {
        for (const onTabRestored of this.onTabRestoredListeners) {
            onTabRestored(tabId, url);
        }
    }
    registerOnTabUpdatedHandler(handler) {
        this.onTabUpdatedHandlers.push(handler);
    }
    notifyOnTabUpdatedHandlers(tabId, changeInfo, tab) {
        for (const onTabUpdated of this.onTabUpdatedHandlers) {
            onTabUpdated(tabId, changeInfo, tab);
        }
    }
    clearState() {
        this.state = new TabStalkerState();
    }
    get windows() { return this.state.windows; }
    get tabs() { return this.state.tabs; }
    get windowsToTabs() { return this.state.windowsToTabs; }
    get tabsToWindows() { return this.state.tabsToWindows; }
    get tabURLs() { return this.state.tabURLs; }
    get windowActivatedTabs() { return this.state.windowActivatedTabs; }
    get windowLastUniqueActivatedTabs() { return this.state.windowLastUniqueActivatedTabs; }
    get activatedTabs() { return this.state.activatedTabs; }
    set activatedTabs(tabs) { this.state.activatedTabs = tabs; }
    get openerTabs() { return this.state.openerTabs; }
    get openerWindows() { return this.state.openerWindows; }
    get restoredSessionTabs() { return this.state.restoredSessionTabs; }
    toString() {
        const windowsToTabsToURLs = new Map();
        for (const [window, tabs] of this.windowsToTabs) {
            let tabsToURLs = new Map();
            for (const tab of tabs) {
                tabsToURLs.set(tab, this.tabURLs.get(tab));
            }
            windowsToTabsToURLs.set(window, tabsToURLs);
        }
        return string_utils_toString({
            windowsToTabsToURLs: windowsToTabsToURLs,
            windowActivatedTabs: this.windowActivatedTabs,
            windowLastUniqueActivatedTabs: this.windowLastUniqueActivatedTabs,
            activatedTabs: this.activatedTabs,
            openerTabs: this.openerTabs,
            openerWindows: this.openerWindows,
        }, 1);
    }
}

;// CONCATENATED MODULE: ./url-status.ts




const urlStatusPath = "/url-status/status/";
var UrlSafetyStatusType;
(function (UrlSafetyStatusType) {
    UrlSafetyStatusType[UrlSafetyStatusType["safe"] = 0] = "safe";
    UrlSafetyStatusType[UrlSafetyStatusType["unsafe"] = 1] = "unsafe";
})(UrlSafetyStatusType || (UrlSafetyStatusType = {}));
class UrlStatusRequester {
    constructor(configNotifier) {
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
    }
    onConfigChanged(config) {
        if (maybe_some(config.threatCloudOrigin) && maybe_some(config.threatCloudAuthParam)) {
            this.requestUrlBase = config.threatCloudOrigin + urlStatusPath + config.threatCloudAuthParam;
        }
        else {
            this.requestUrlBase = undefined;
        }
    }
    get(url) {
        return new Promise((resolve, reject) => {
            if (maybe_none(this.requestUrlBase)) {
                logError("UrlStatusRequester: request URL is undefined");
                reject();
            }
            const requestUrl = this.requestUrlBase + "&urls=" + encodeURIComponent(url);
            fetch(requestUrl).then(response => {
                switch (response.status) {
                    case 200:
                        return response.json();
                    default:
                        throw new Error(`UrlStatusRequester: server status: ${response.status}`);
                }
            }).then(responseJson => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                const data = responseJson[0];
                const overridenData = {
                    overridden: data.overrides ? true : false,
                    status_code: (_b = (_a = data.overrides) === null || _a === void 0 ? void 0 : _a.status_code) !== null && _b !== void 0 ? _b : data.status_code,
                    status_message: (_d = (_c = data.overrides) === null || _c === void 0 ? void 0 : _c.status_message) !== null && _d !== void 0 ? _d : data.status_message,
                    domain_grey: (_f = (_e = data.overrides) === null || _e === void 0 ? void 0 : _e.domain_grey) !== null && _f !== void 0 ? _f : data.domain_grey,
                    categories: (_h = (_g = data.overrides) === null || _g === void 0 ? void 0 : _g.categories) !== null && _h !== void 0 ? _h : data.categories,
                };
                resolve(overridenData);
            }).catch(error => {
                logError(`UrlStatusRequester: fetch error: ${string_utils_toString(error)}`);
                reject();
            });
        });
    }
}

;// CONCATENATED MODULE: ./url-filtering.ts






class UrlFilteringManager {
    constructor(configNotifier, alarmManager, navigationCompleteNotifier, urlStatusRequester, domainWhoisRequester, trustedUrlTracker) {
        this.urlStatusRequester = urlStatusRequester;
        this.domainWhoisRequester = domainWhoisRequester;
        this.trustedUrlTracker = trustedUrlTracker;
        this.blockedCategories = new Set();
        this.urlFilteringEnabled = false;
        this.storedUrlStatuses = new Map();
        this.waitingItems = new Map();
        this.waitingDomainAgeItems = new Map();
        this.urlStatusCheckEnabled = false;
        this.domainAgeCheckEnabled = false;
        this.domainAgeCheckMinDays = 30;
        this.tenuredDomainCache = new TenuredDomainCache();
        configNotifier.addConfigListenerForKey(config => {
            this.urlFilteringEnabled = config.ufEnabled;
            this.blockedCategories = new Set(config.ufBlockedCategories);
            this.domainAgeCheckMinDays = config.ufDomainAgeCheckMinDays;
            if (this.domainAgeCheckMinDays != config.ufDomainAgeCheckMinDays) {
                log_log('UrlFilteringManager clearing tenured domain cache');
                this.tenuredDomainCache.clear();
            }
            if (this.urlFilteringEnabled) {
                log_log('URL Filtering enabled');
                this.domainAgeCheckEnabled = config.ufDomainAgeCheckEnabled;
                if (this.domainAgeCheckEnabled) {
                    log_log(`Domain age checking for URL Filtering enabled, threshold: ${this.domainAgeCheckMinDays} days`);
                }
                else {
                    log_log('Domain age checking for URL Filtering explicitly disabled');
                }
                this.urlStatusCheckEnabled = config.ufStatusCodeCheckEnabled;
                if (this.urlStatusCheckEnabled) {
                    log_log(`Status code checking for URL Filtering enabled`);
                }
                else {
                    log_log('Status code checking for URL Filtering explicitly disabled');
                }
            }
            else {
                log_log('URL Filtering disabled; disabling domain age and status checking');
                this.tenuredDomainCache.clear();
                this.domainAgeCheckEnabled = false;
                this.urlStatusCheckEnabled = false;
            }
        }, ConfigKey.config);
        alarmManager.registerPeriodicAlarm(AlarmName.hpCloudListClearDeadEntries, UrlFilteringManager.ttlMins, () => this.clearDeadEntries());
        navigationCompleteNotifier.registerOnNavigationCompletedHandler(url => this.queryUrlStatus(url));
        navigationCompleteNotifier.registerOnNavigationCompletedHandler(url => this.queryDomainAge(url));
    }
    shouldBlock(url) {
        const urlObject = new URL(url);
        if (this.trustedUrlTracker.isTrustedUrl(urlObject)) {
            log_log(`UrlFilteringManager: ${url} is a trusted site`);
            const defaultBlockResponse = { categoryblock: false, statusblock: false, blockingCategories: [], statusCode: UrlSafetyStatusType.safe, statusMsg: [], overridden: false };
            const defaultDomainAgeResponse = { block: false, domainAgeDays: undefined, thresholdDays: this.domainAgeCheckMinDays };
            return Promise.resolve([defaultBlockResponse, defaultDomainAgeResponse]);
        }
        return Promise.all([this.checkUrlStatus(url), this.checkDomainAge(url)]);
    }
    checkUrlStatus(url) {
        return new Promise((resolve, reject) => this.queryUrlStatus(url, resolve));
    }
    checkDomainAge(url) {
        return new Promise((resolve, reject) => this.queryDomainAge(url, resolve));
    }
    async queryDomainAge(url, shouldBlockResolver) {
        var _a, _b;
        if (!this.urlFilteringEnabled || !this.domainAgeCheckEnabled) {
            shouldBlockResolver === null || shouldBlockResolver === void 0 ? void 0 : shouldBlockResolver({ block: false, domainAgeDays: undefined, thresholdDays: this.domainAgeCheckMinDays });
            return;
        }
        const urlObject = new URL(url);
        const domain = urlObject.hostname;
        if (this.tenuredDomainCache.has(domain)) {
            shouldBlockResolver === null || shouldBlockResolver === void 0 ? void 0 : shouldBlockResolver({ block: false, domainAgeDays: undefined, thresholdDays: this.domainAgeCheckMinDays });
            return;
        }
        if (this.waitingDomainAgeItems.has(url)) {
            this.waitingDomainAgeItems.get(url).push(shouldBlockResolver);
            return;
        }
        log_log(`UrlFilteringManager: fetching createddate for ${url}`);
        this.waitingDomainAgeItems.set(url, [shouldBlockResolver]);
        try {
            const domainAgeDays = await this.domainWhoisRequester.getCreatedDateAgeDays(url);
            const domainAgeDaysThreshold = this.domainAgeCheckMinDays;
            const shouldBlock = domainAgeDays < domainAgeDaysThreshold;
            log_log(`UrlFilteringManager: Domain ${domain} (URL ${url}) is ${domainAgeDays} days old; configured minimum threshold: ${domainAgeDaysThreshold}; should block: ${shouldBlock}`);
            if (!shouldBlock) {
                this.tenuredDomainCache.add(domain);
            }
            for (const resolver of (_a = this.waitingDomainAgeItems.get(url)) !== null && _a !== void 0 ? _a : []) {
                resolver === null || resolver === void 0 ? void 0 : resolver({ block: shouldBlock, domainAgeDays: domainAgeDays, thresholdDays: domainAgeDaysThreshold });
            }
            this.waitingDomainAgeItems.delete(url);
        }
        catch (_) {
            logError(`UrlFilteringManager: Failed to lookup creation date for ${domain} (url ${url})`);
            for (const resolver of (_b = this.waitingDomainAgeItems.get(url)) !== null && _b !== void 0 ? _b : []) {
                resolver === null || resolver === void 0 ? void 0 : resolver({ block: false, domainAgeDays: undefined, thresholdDays: undefined });
            }
            this.waitingDomainAgeItems.delete(url);
        }
    }
    queryUrlStatus(url, shouldBlockResolver) {
        var _a;
        if (!this.urlFilteringEnabled) {
            shouldBlockResolver === null || shouldBlockResolver === void 0 ? void 0 : shouldBlockResolver({ categoryblock: false, statusblock: false, blockingCategories: [], statusCode: UrlSafetyStatusType.safe, statusMsg: [], overridden: false });
            return;
        }
        const storedStatus = (_a = this.storedUrlStatuses.get(url)) === null || _a === void 0 ? void 0 : _a.status;
        if (maybe_some(storedStatus)) {
            this.storedUrlStatuses.set(url, { status: storedStatus, timestamp: Date.now() });
            shouldBlockResolver === null || shouldBlockResolver === void 0 ? void 0 : shouldBlockResolver(this.shouldBlockUrlStatus(storedStatus));
            return;
        }
        if (this.waitingItems.has(url)) {
            this.waitingItems.get(url).push(shouldBlockResolver);
            return;
        }
        log_log(`UrlFilteringManager: fetching url-status for ${url}`);
        this.waitingItems.set(url, [shouldBlockResolver]);
        this.urlStatusRequester.get(url).then(status => {
            var _a;
            this.storedUrlStatuses.set(url, { status, timestamp: Date.now() });
            const result = this.shouldBlockUrlStatus(status);
            log_log(`UrlFilteringManager: results ${result.overridden ? "are" : "are not"} overriden for ${url}`);
            log_log(`UrlFilteringManager: blocking categories are [${result.blockingCategories}] for ${url}`);
            log_log(`UrlFilteringManager: status code is [${result.statusCode}], status message is [${result.statusMsg}] for ${url}`);
            for (const resolver of (_a = this.waitingItems.get(url)) !== null && _a !== void 0 ? _a : []) {
                resolver === null || resolver === void 0 ? void 0 : resolver(result);
            }
            this.waitingItems.delete(url);
        }).catch(() => {
            var _a;
            for (const resolver of (_a = this.waitingItems.get(url)) !== null && _a !== void 0 ? _a : []) {
                resolver === null || resolver === void 0 ? void 0 : resolver({ categoryblock: false, statusblock: false, blockingCategories: [], statusCode: UrlSafetyStatusType.safe, statusMsg: [], overridden: false });
            }
            this.waitingItems.delete(url);
        });
    }
    shouldBlockUrlStatus(status) {
        const statusCode = status.status_code;
        const blockingStatusCode = this.urlStatusCheckEnabled && statusCode === UrlSafetyStatusType.unsafe;
        if (!blockingStatusCode && maybe_none(status.categories)) {
            return { categoryblock: false, statusblock: false, blockingCategories: [], statusCode: UrlSafetyStatusType.safe, statusMsg: [], overridden: false };
        }
        const blockingCategories = maybe_some(status.categories) ? status.categories.filter(category => this.blockedCategories.has(category)) : [];
        const statusMsg = status.status_message;
        const overridden = status.overridden;
        return { categoryblock: blockingCategories.length > 0,
            statusblock: blockingStatusCode,
            blockingCategories,
            statusCode,
            statusMsg,
            overridden };
    }
    clearDeadEntries() {
        const deadEntries = new Set();
        const now = Date.now();
        for (const [url, entry] of this.storedUrlStatuses) {
            if (UrlFilteringManager.ttl < now - entry.timestamp) {
                deadEntries.add(url);
            }
        }
        for (const key of deadEntries) {
            this.storedUrlStatuses.delete(key);
        }
    }
    static get ttlMins() { return 5; }
    static get ttl() { return UrlFilteringManager.ttlMins * 60 * 1000; }
}

;// CONCATENATED MODULE: ../lib/common/boolean-utils.ts
function isTrue(value) {
    return value === true;
}
function isFalse(value) {
    return value === false;
}

;// CONCATENATED MODULE: ../lib/common/url-parse-utils.ts


function findDocumentUrl(window) {
    return parseUrl(window.location.toString());
}
function findDocumentQueryParam(documentUrl, queryParam) {
    if (maybe_none(documentUrl)) {
        return "";
    }
    const value = documentUrl.searchParams.get(queryParam);
    if (value === null) {
        return undefined;
    }
    return value;
}
function findURLDocumentQueryParam(documentUrl, queryParam) {
    const queryParamValue = findDocumentQueryParam(documentUrl, queryParam);
    if (maybe_none(queryParamValue)) {
        return undefined;
    }
    return url_utils_parseUrl(queryParamValue);
}

;// CONCATENATED MODULE: ./web-request-listener.ts

















function ifIncognitoTab(tabId, action) {
    chrome.tabs.get(tabId, tab => {
        if (tab.incognito) {
            action();
        }
    });
}
var Comparison;
(function (Comparison) {
    Comparison[Comparison["lessThan"] = -1] = "lessThan";
    Comparison[Comparison["equal"] = 0] = "equal";
    Comparison[Comparison["greaterThan"] = 1] = "greaterThan";
})(Comparison || (Comparison = {}));
class WebRequestListenerState {
    constructor() {
        this.pendingRedirects = new Set();
        this.tabs = new Set();
        this.tabURLs = new Map();
        this.redirectBackToSrcInfo = new Map();
    }
}
class WebRequestListener {
    constructor(configNotifier, tabStalker, placementManager, blockedPageController, fileBlocker, browserLauncher, phishingNavSequenceDetector, externalAppLinkController, featureManager, onConfigured, linkProtectionService, eventSource) {
        this.tabStalker = tabStalker;
        this.placementManager = placementManager;
        this.blockedPageController = blockedPageController;
        this.fileBlocker = fileBlocker;
        this.browserLauncher = browserLauncher;
        this.phishingNavSequenceDetector = phishingNavSequenceDetector;
        this.externalAppLinkController = externalAppLinkController;
        this.featureManager = featureManager;
        this.onConfigured = onConfigured;
        this.linkProtectionService = linkProtectionService;
        this.eventSource = eventSource;
        this.shouldRegisterListeners = false;
        this.hasRegisteredListeners = false;
        this.state = new WebRequestListenerState();
        this.promptForUncategorized = false;
        this.closeLaunchedPageTabs = false;
        this.credentialProtectionEnabled = false;
        this.urlFilteringEnabled = false;
        this.onNavigationHandlers = new Array();
        this.onNavigationCompleteHandlers = new Array();
        eventSource.registerListener(this);
        configNotifier.addConfigListenerForKey(config => this.onConfigChanged(config), ConfigKey.config);
        configNotifier.addConfigUpdateCompleteListenerForKeys(() => this.updateListeners(), [ConfigKey.config, ConfigKey.sbxEnabledFeatures]);
        this.tabStalker.registerOnTabClosedHandler((tabId) => this.onTabClosed(tabId));
        this.tabStalker.registerOnTabRestoredListeners((tabId, url) => this.onTabRestored(tabId, url));
        this.externalAppLinkController.onUnresolvedConnection.registerEventHandler(({ tabId, url }) => {
            this.onUnresolvedExternalAppLink(tabId, url);
        });
    }
    onConfigChanged(config) {
        this.promptForUncategorized = config.promptForUncategorized;
        this.closeLaunchedPageTabs = config.closeLaunchedPageTabs;
        this.credentialProtectionEnabled = config.ipEnabled;
        this.urlFilteringEnabled = config.ufEnabled;
    }
    onTabRestored(tabId, url) {
        const isNewTab = this.detectedTab(tabId);
        if (!isNewTab) {
            return;
        }
        this.onConfigured.registerListener(() => {
            log_log(`WebRequestListener.onTabRestored: tabId: ${tabId} url: ${url}`);
            const urlCategories = this.categorizeURL(url);
            const groups = this.findGroups(url);
            const didUserCreateTab = this.didUserCreateTab(tabId);
            const timeStamp = Date.now();
            const isFreshNavSeq = false;
            this.detectPhishingNavSequenceOnNavigate(tabId, timeStamp, url, urlCategories, groups, isNewTab, didUserCreateTab, isFreshNavSeq);
            this.onTabNavigated(tabId, url);
        });
    }
    isRestoredSessionTab(tabId) {
        return this.tabStalker.isRestoredSessionTab(tabId);
    }
    findTabURL(tabId, isRedirect = undefined) {
        if (maybe_none(tabId)) {
            return undefined;
        }
        const webRequestListenerURL = this.tabURLs.get(tabId);
        let tabStalkerURL = undefined;
        const urlOrSpec = this.tabStalker.findTabURL(tabId);
        if (maybe_some(urlOrSpec)) {
            tabStalkerURL = parseURLIfNecessary(urlOrSpec);
        }
        if (maybe_some(webRequestListenerURL) && maybe_some(tabStalkerURL)) {
            if (isTrue(isRedirect)) {
                return webRequestListenerURL;
            }
            if (!url_utils_isSameUrl(webRequestListenerURL, tabStalkerURL)) {
                if (!origin_isSameOrigin(origin_parseOrigin(webRequestListenerURL), origin_parseOrigin(tabStalkerURL))) {
                    logError(new Error(`webRequestListenerURL "${webRequestListenerURL}" and tabStalkerURL` +
                        ` "${tabStalkerURL}" do not match for tab ${tabId}. Will use tabStalkerURL`));
                }
            }
            return tabStalkerURL;
        }
        if (maybe_some(webRequestListenerURL)) {
            return webRequestListenerURL;
        }
        if (maybe_some(tabStalkerURL)) {
            return tabStalkerURL;
        }
        return undefined;
    }
    findOpenerTabId(tabId) {
        return this.tabStalker.findOpenerTabId(tabId);
    }
    findOpenerWindowTabId(windowId) {
        const ids = this.tabStalker.findOpenerWindowId(windowId);
        if (maybe_none(ids)) {
            return undefined;
        }
        const [, openerTabId] = ids;
        return openerTabId;
    }
    findParentTabIds(tabId, isNewTab) {
        const filterUniqueTabIds = (tabIds) => {
            const uniqueTabsIds = [];
            const unorderedUniqueTabIds = new Set();
            for (const tabId of tabIds) {
                if (!unorderedUniqueTabIds.has(tabId)) {
                    unorderedUniqueTabIds.add(tabId);
                    uniqueTabsIds.push(tabId);
                }
            }
            return uniqueTabsIds;
        };
        const removeTabId = (tabIds, tabIdToRemove) => {
            return tabIds.filter((tabId) => tabId !== tabIdToRemove);
        };
        const isSameTab = (parentTabId) => {
            return tabId === parentTabId;
        };
        let parentTabIds = [];
        const openerTabId = this.findOpenerTabId(tabId);
        if (maybe_some(openerTabId) && !isSameTab(openerTabId)) {
            parentTabIds.push(openerTabId);
        }
        const activatedTabId = this.tabStalker.activatedTabId;
        if (maybe_some(activatedTabId)) {
            if (!isSameTab(activatedTabId)) {
                parentTabIds.push(activatedTabId);
            }
            else {
                const lastActivatedTabId = this.tabStalker.lastActivatedTabId;
                if (maybe_some(lastActivatedTabId) && !isSameTab(lastActivatedTabId)) {
                    parentTabIds.push(lastActivatedTabId);
                }
            }
        }
        const lastFocusedWindowActivatedTabId = this.tabStalker.lastFocusedWindowActivatedTabId;
        if (maybe_some(lastFocusedWindowActivatedTabId) && !isSameTab(lastFocusedWindowActivatedTabId)) {
            parentTabIds.push(lastFocusedWindowActivatedTabId);
        }
        const maybeNewWindowId = this.tabStalker.maybeNewWindowId;
        if (maybe_some(maybeNewWindowId) && isNewTab) {
            const openerWindowTabId = this.findOpenerWindowTabId(maybeNewWindowId);
            if (maybe_some(openerWindowTabId) && !isSameTab(openerWindowTabId)) {
                parentTabIds.push(openerWindowTabId);
            }
        }
        const lastFocusedWindowId = this.tabStalker.lastFocusedWindowId;
        if (maybe_some(lastFocusedWindowId) && isNewTab) {
            const popupWindowTabId = this.tabStalker.findPopupWindowTabId(lastFocusedWindowId);
            if (maybe_some(popupWindowTabId) && !isSameTab(popupWindowTabId)) {
                parentTabIds.push(popupWindowTabId);
            }
        }
        parentTabIds = filterUniqueTabIds(parentTabIds);
        parentTabIds = removeTabId(parentTabIds, tabId);
        log_log(`findParentTabIds: ${string_utils_toString({
            parentTabIds: parentTabIds,
            tabStalker: this.tabStalker
        })}`);
        return parentTabIds;
    }
    findSrcURL(tabId, initiator, initiatorIsSrc, isRedirect) {
        let srcURL = this.findTabURL(tabId, isRedirect);
        if (maybe_none(srcURL) && initiatorIsSrc && maybe_some(initiator)) {
            srcURL = url_utils_parseUrl(initiator);
        }
        return srcURL;
    }
    isBlockedPageURL(url) {
        return this.blockedPageController.isBlockedPageURL(url);
    }
    isBlockedFilePageURL(url) {
        return this.fileBlocker.isBlockedFilePageURL(url);
    }
    isExternalAppLinkURL(url) {
        return this.externalAppLinkController.isExternalAppLinkURL(url);
    }
    isNewTabPageUrl(url) {
        if (maybe_none(url)) {
            return false;
        }
        return this.placementManager.isNewTabPageUrl(url);
    }
    isPhishingSourceSite(url) {
        if (maybe_none(url)) {
            return false;
        }
        const isPhishingSourceSite = this.placementManager.isPhishingSourceSite(url);
        return isTrue(isPhishingSourceSite);
    }
    isWebMailSite(url) {
        if (maybe_none(url)) {
            return false;
        }
        const isWebMailSite = this.placementManager.isWebMailSite(url);
        return isTrue(isWebMailSite);
    }
    findGroups(url) {
        if (maybe_none(url)) {
            return [];
        }
        const groups = this.placementManager.findGroups(url);
        if (maybe_none(groups)) {
            return [];
        }
        return groups;
    }
    shouldBlockNavigation(isFreshNavSeq, isNewTab, isRedirect, httpMethod, sameTabSourceURL, parentURL) {
        if (isFreshNavSeq || maybe_none(httpMethod)) {
            return false;
        }
        const sourceURL = isNewTab ? parentURL : sameTabSourceURL;
        if (maybe_none(sourceURL)) {
            return false;
        }
        const tabType = isNewTab ? TabType.newTab : TabType.sameTab;
        const navType = isRedirect ? NavType.redirect : NavType.navigation;
        const shouldBlock = this.placementManager.shouldBlockNavigation(tabType, navType, httpMethod, sourceURL);
        return isTrue(shouldBlock);
    }
    isAuthRequest(srcURL, destURL) {
        if (maybe_none(srcURL) || maybe_none(destURL)) {
            return false;
        }
        const siteRequiresAuth = this.placementManager.siteRequiresAuth(srcURL);
        const isAuthSite = this.placementManager.isAuthSite(destURL);
        const isAuthRequest = isTrue(siteRequiresAuth) && isTrue(isAuthSite);
        return isAuthRequest;
    }
    isTrustedURL(url) {
        const isTrusted = true;
        const isUntrusted = true;
        if (maybe_none(url)) {
            return [!isTrusted, !isUntrusted];
        }
        const isTrustedURL = this.placementManager.isTrustedUrl(url);
        if (maybe_none(isTrustedURL)) {
            return [!isTrusted, !isUntrusted];
        }
        return [isTrustedURL, !isTrustedURL];
    }
    isTrustedFileURL(fileURL) {
        const isFileURL = true;
        const isTrusted = true;
        const isUntrusted = true;
        if (maybe_none(fileURL) || !isFileUrl(fileURL)) {
            return [!isFileURL, !isTrusted, !isUntrusted];
        }
        const isTrustedFileURL = this.placementManager.isTrustedFileUrl(fileURL);
        if (maybe_none(isTrustedFileURL)) {
            return [isFileURL, !isTrusted, !isUntrusted];
        }
        return [isFileURL, isTrustedFileURL, !isTrustedFileURL];
    }
    isSameOrigin(srcURL, destURL) {
        if (maybe_none(srcURL) || maybe_none(destURL)) {
            return false;
        }
        const srcOrigin = origin_parseOrigin(srcURL);
        const destOrigin = origin_parseOrigin(destURL);
        if (maybe_none(srcOrigin) || maybe_none(destOrigin)) {
            return false;
        }
        return origin_isSameOrigin(srcOrigin, destOrigin);
    }
    isRedirect(requestId) {
        return this.pendingRedirects.has(requestId);
    }
    clearPendingRedirect(requestId) {
        this.pendingRedirects.delete(requestId);
    }
    createLaunchedPageURL(launchedURL, contentType, showLaunchButtons) {
        return this.browserLauncher.createLaunchedPageURL(launchedURL, contentType, showLaunchButtons);
    }
    launchBrowser(url) {
        if (maybe_none(url)) {
            return;
        }
        this.browserLauncher.launchBrowser(url);
    }
    launchBrowserAndCloseTabOrNavigateTab(tabId, url, contentType, closeTab) {
        if (maybe_none(url)) {
            return;
        }
        this.browserLauncher.launchBrowserAndCloseTabOrNavigateTab(tabId, url, contentType, closeTab);
    }
    closeTab(tabId, onTabClosed = () => { }) {
        setTimeout(() => {
            chrome.tabs.remove(tabId, () => {
                log_log(`WebRequestListener.closeTab: tabId: ${tabId}`);
                onTabClosed(tabId);
            });
        }, 100);
    }
    closeTabAndLaunchBrowser(tabId, url) {
        this.closeTab(tabId, () => {
            this.launchBrowser(url);
        });
    }
    onTabClosed(tabId) {
        log_log(`WebRequestListener.onTabClosed: tabId: ${tabId}`);
        this.tabURLs.delete(tabId);
        this.tabs.delete(tabId);
    }
    detectedTab(tabId) {
        const isNewTab = !this.tabs.has(tabId);
        if (isNewTab) {
            this.tabs.add(tabId);
            this.phishingNavSequenceDetector.onTabDetected(tabId);
        }
        return isNewTab;
    }
    didUserCreateTab(tabId) {
        return this.tabStalker.didUserCreateTab(tabId);
    }
    onTabNavigated(tabId, url) {
        if (maybe_none(url)) {
            return;
        }
        this.tabURLs.set(tabId, url);
    }
    detectedExternalAppLink(tabId) {
        this.externalAppLinkController.onExternalAppLinkDetected(tabId);
    }
    detectedParentTab(tabId, timeStamp, url, urlCategories, groups) {
        if (maybe_none(url)) {
            return;
        }
        if (this.isBlockedPageURL(url)) {
            return;
        }
        if (!this.phishingNavSequenceDetector.onParentTabDetected(tabId, timeStamp, url, urlCategories, groups)) {
            logError(new Error(`WebRequestListener.detectedParentTab: ${string_utils_toString({
                tabId: tabId,
                url: url,
                urlCategories: urlCategoryToString(urlCategories),
                groups: groups
            })}`));
        }
    }
    detectPhishingNavSequence(url, doDetect) {
        if (maybe_none(url)) {
            return new EmptyNavSequenceDetections();
        }
        if (this.isBlockedPageURL(url) || this.isBlockedFilePageURL(url)) {
            return new EmptyNavSequenceDetections();
        }
        return doDetect(this.phishingNavSequenceDetector, url);
    }
    detectPhishingNavSequenceOnNavigate(tabId, timeStamp, url, urlCategories, groups, isNewTab, didUserCreateTab, isFreshNavSeq) {
        return this.detectPhishingNavSequence(url, (phishingNavSequenceDetector, url) => {
            return phishingNavSequenceDetector.onNavigate(tabId, timeStamp, url, urlCategories, groups, isNewTab, didUserCreateTab, isFreshNavSeq);
        });
    }
    detectPhishingNavSequenceOnRedirect(tabId, timeStamp, url, urlCategories, groups) {
        return this.detectPhishingNavSequence(url, (phishingNavSequenceDetector, url) => {
            return phishingNavSequenceDetector.onRedirect(tabId, timeStamp, url, urlCategories, groups);
        });
    }
    detectPhishingNavSequenceOnContentType(tabId, timeStamp, url, urlCategories, groups, contentType) {
        return this.detectPhishingNavSequence(url, (phishingNavSequenceDetector, url) => {
            return phishingNavSequenceDetector.onContentType(tabId, timeStamp, url, urlCategories, groups, contentType);
        });
    }
    hasHigherPrecedenceThanBuiltin(navSequenceDetections) {
        return this.phishingNavSequenceDetector.hasHigherPrecedenceThanBuiltin(navSequenceDetections);
    }
    categorizeURL(url) {
        const [isTrustedURL, isUntrustedURL] = this.isTrustedURL(url);
        const isPhishingSourceSite = this.isPhishingSourceSite(url);
        const isWebMailSite = this.isWebMailSite(url);
        const isExternalAppLinkURL = this.isExternalAppLinkURL(url);
        const urlCategories = categorizeUrl(isTrustedURL, isUntrustedURL, isPhishingSourceSite, isWebMailSite, isExternalAppLinkURL);
        log_log(`WebRequestListener.categorizeURL: ${string_utils_toString({
            url: url,
            urlCategories: urlCategoryToString(urlCategories)
        })}`);
        return urlCategories;
    }
    get shouldOpenPhishingLinksInSecureBrowser() {
        return this.placementManager.shouldOpenPhishingLinksInSecureBrowser;
    }
    isBlockedPageContinueNavigation(srcURL, destURL) {
        if (this.isBlockedPageURL(srcURL)) {
            const srcBlockedPageNavigateToURL = findURLDocumentQueryParam(srcURL, OptionNames.navigateToSpec);
            if (maybe_some(destURL) && maybe_some(srcBlockedPageNavigateToURL)) {
                return url_utils_isSameUrl(destURL, srcBlockedPageNavigateToURL);
            }
        }
        return false;
    }
    continueNavigation() {
        return {
            cancel: false
        };
    }
    blockNavigation() {
        return {
            cancel: true
        };
    }
    redirectNavigation(tabId, url) {
        if (maybe_none(url)) {
            logError("Invalid redirect URL. Letting navigation proceed");
            return this.continueNavigation();
        }
        this.onTabNavigated(tabId, url);
        return {
            redirectUrl: URLToString(url)
        };
    }
    ;
    launchBrowserAndCloseTab(tabId, launchURL, backToSrcURL = undefined) {
        return this.launchBrowserAndCloseTabWithContentType(tabId, launchURL, unknownContentType, backToSrcURL);
    }
    launchBrowserAndCloseTabWithContentType(tabId, launchURL, contentType, backToSrcURL = undefined) {
        if (maybe_none(launchURL)) {
            logError("Can't launch Secure Browser. Letting navigation proceed");
            return this.continueNavigation();
        }
        const redirectURL = this.createLaunchedPageURL(launchURL, contentType, !this.closeLaunchedPageTabs);
        let shouldRedirectAndKeepTab = maybe_some(backToSrcURL) && !url_utils_isSameUrl(launchURL, backToSrcURL) && maybe_some(redirectURL);
        if (shouldRedirectAndKeepTab && this.closeLaunchedPageTabs) {
            log_log(`Configured not to show the launched page so tab ${tabId} will be closed`);
            shouldRedirectAndKeepTab = false;
        }
        chrome.tabs.get(tabId, () => {
            const errorMessage = checkRuntimeLastError();
            if (maybe_some(errorMessage)) {
                log_log(`launchBrowser will not be called because an error ` +
                    `was encountered while checking if the tabId (${tabId}) was ` +
                    `valid in onBeforeRequest: blockUntrusted - "${errorMessage}"`);
                return;
            }
            this.launchBrowserAndCloseTabOrNavigateTab(tabId, launchURL, contentType, !shouldRedirectAndKeepTab);
        });
        return this.redirectNavigation(tabId, redirectURL);
    }
    onUnresolvedExternalAppLink(tabId, srcURL) {
        if (!this.hasRegisteredListeners) {
            return;
        }
        const timeStamp = Date.now();
        const isNewTab = this.detectedTab(tabId);
        const didUserCreateTab = this.didUserCreateTab(tabId);
        const isFreshNavSeq = true;
        log_log(`A missed external app link navigation has been detected in tab ${tabId}`);
        const srcGroups = this.findGroups(srcURL);
        this.detectPhishingNavSequenceOnNavigate(tabId, timeStamp, srcURL, UrlCategory.externalAppLink, srcGroups, isNewTab, didUserCreateTab, isFreshNavSeq);
        this.onTabNavigated(tabId, srcURL);
    }
    selectParentTab(parentTabIds, initiator, initiatorIsParent) {
        if (initiatorIsParent && maybe_some(initiator)) {
            const parentURL = url_utils_parseUrl(initiator);
            if (maybe_some(parentURL)) {
                return [undefined, parentURL, this.categorizeURL(parentURL)];
            }
        }
        const sortedParentTabs = parentTabIds.map((parentTabId) => {
            const parentURL = this.findTabURL(parentTabId);
            const parentURLCategories = this.categorizeURL(parentURL);
            return [parentTabId, parentURL, parentURLCategories];
        }).sort((a, b) => {
            const [, , urlCategoriesA] = a;
            const [, , urlCategoriesB] = b;
            const isWebMailSiteA = (urlCategoriesA & UrlCategory.webMailSiteUrl) !== 0;
            const isWebMailSiteB = (urlCategoriesB & UrlCategory.webMailSiteUrl) !== 0;
            const isPhishingSourceSiteA = (urlCategoriesA & UrlCategory.phishingSourceSiteUrl) !== 0;
            const isPhishingSourceSiteB = (urlCategoriesB & UrlCategory.phishingSourceSiteUrl) !== 0;
            if (isWebMailSiteA) {
                return Comparison.lessThan;
            }
            else if (isWebMailSiteB) {
                return Comparison.greaterThan;
            }
            else if (isPhishingSourceSiteA) {
                return Comparison.lessThan;
            }
            else if (isPhishingSourceSiteB) {
                return Comparison.greaterThan;
            }
            else {
                return Comparison.equal;
            }
        });
        log_log(`selectParentTab: sortedParentTabs: ${string_utils_toString(sortedParentTabs.map(([tabId, url, urlCategories]) => [
            tabId,
            url,
            urlCategoryToString(urlCategories)
        ]))}`);
        if (isEmpty(sortedParentTabs)) {
            return [undefined, undefined, UrlCategory.uncategorizedUrl];
        }
        const selectedParentTab = first(sortedParentTabs);
        return selectedParentTab;
    }
    getBackToSrcURL(requestId) {
        const info = this.redirectBackToSrcInfo.get(requestId);
        if (maybe_none(info)) {
            return undefined;
        }
        const { srcURL, isNewTab, didUserCreateTab } = info;
        if (isNewTab && !didUserCreateTab) {
            return undefined;
        }
        return srcURL;
    }
    getInitiator(onBeforeRequestDetails) {
        switch (currentBrowser) {
            case Browser.chrome:
                return onBeforeRequestDetails.initiator;
            case Browser.edgeChromium:
                return onBeforeRequestDetails.initiator;
            case Browser.firefox:
                return onBeforeRequestDetails.originUrl;
            default:
                return undefined;
        }
    }
    onBeforeRequest(details) {
        this.onBeforeRequestBlocking(details);
    }
    onBeforeRequestBlocking(details) {
        const requestId = details.requestId;
        log_log(`onBeforeRequest: ${requestId}`);
        const tabId = details.tabId;
        const frameId = details.frameId;
        const destURL = url_utils_parseUrl(details.url);
        const httpMethod = parseHttpMethod(details.method);
        if (!this.onConfigured.isConfigured) {
            log_log("Extension is not yet fully configured so request will be allowed to proceed");
            this.onTabNavigated(tabId, destURL);
            return this.continueNavigation();
        }
        const didUserCreateTab = this.didUserCreateTab(tabId);
        const isNewTab = this.detectedTab(tabId);
        const isRestoredSessionTab = this.isRestoredSessionTab(tabId);
        const considerParentTab = isNewTab && !didUserCreateTab;
        const initiator = this.getInitiator(details);
        const initiatorIsParent = considerParentTab;
        const initiatorIsSrc = !considerParentTab;
        const isRedirect = this.isRedirect(requestId);
        if (isRedirect) {
            this.clearPendingRedirect(requestId);
        }
        const isFreshNavSeq = maybe_none(initiator) && !isRedirect;
        if (!isRedirect) {
            this.notifyOnNavigationHandlers(tabId, isFreshNavSeq);
        }
        let parentTabId, parentURL, parentURLCategories = UrlCategory.uncategorizedUrl;
        if (considerParentTab) {
            const parentTabIds = this.findParentTabIds(tabId, isNewTab);
            const selectedParentTab = this.selectParentTab(parentTabIds, initiator, initiatorIsParent);
            [parentTabId, parentURL, parentURLCategories] = selectedParentTab;
        }
        const srcURL = this.findSrcURL(tabId, initiator, initiatorIsSrc, isRedirect);
        if (maybe_some(srcURL) && !this.isExternalAppLinkURL(srcURL) && !isRedirect) {
            this.redirectBackToSrcInfo.set(requestId, { srcURL, isNewTab, didUserCreateTab });
        }
        else {
            this.redirectBackToSrcInfo.delete(requestId);
        }
        const proceed = () => {
            log_log(`onBeforeRequest: ${requestId}: proceed`);
            this.onTabNavigated(tabId, destURL);
            return this.continueNavigation();
        };
        const blockBase = (name, raiseLinkProtectionServiceEvent, url, blockedNavSequence = undefined) => {
            log_log(`onBeforeRequest: ${requestId}: ${name}`);
            raiseLinkProtectionServiceEvent();
            if (!this.featureManager.isLinkProtectionEnabled) {
                log_log(`onBeforeRequest: ${name}: link protection is not enabled`);
                return proceed();
            }
            if (this.shouldOpenPhishingLinksInSecureBrowser) {
                return this.launchBrowserAndCloseTab(tabId, url);
            }
            ifIncognitoTab(tabId, () => {
                this.closeTabAndLaunchBrowser(tabId, url);
            });
            this.phishingNavSequenceDetector.resetDetector(tabId);
            let blockedPageURL;
            if (maybe_some(blockedNavSequence)) {
                blockedPageURL = this.blockedPageController.blockNavigationWithNavSequence(url, blockedNavSequence, tabId);
            }
            else {
                blockedPageURL = this.blockedPageController.blockNavigation(url, tabId);
            }
            return this.redirectNavigation(tabId, blockedPageURL);
        };
        const block = (url) => {
            return blockBase("block", () => this.linkProtectionService.raiseBlockEvent(tabId, details.timeStamp, destURL, considerParentTab ? parentURL : srcURL), url);
        };
        const blockUncategorized = (url) => {
            return blockBase("blockUncategorized", () => this.linkProtectionService.raiseBlockUncategorizedEvent(tabId, details.timeStamp, destURL), url);
        };
        const blockWithNavSequence = (url, blockedNavSequence) => {
            return blockBase("blockWithNavSequence", () => this.linkProtectionService.raiseBlockWithNavSequenceEvent(tabId, details.timeStamp, destURL, blockedNavSequence), url, blockedNavSequence);
        };
        const blockUntrusted = (url) => {
            log_log(`onBeforeRequest: ${requestId}: blockUntrusted`);
            this.linkProtectionService.raiseBlockUntrustedEvent(tabId, details.timeStamp, destURL);
            if (!this.featureManager.isLinkProtectionEnabled) {
                log_log(`onBeforeRequest: blockUntrusted: link protection is not enabled`);
                return proceed();
            }
            const backToSrcURL = this.getBackToSrcURL(requestId);
            return this.launchBrowserAndCloseTab(tabId, url, backToSrcURL);
        };
        const blockFile = (fileURL) => {
            log_log(`onBeforeRequest: ${requestId}: blockFile`);
            if (!this.featureManager.isFileURLProtectionEnabled) {
                log_log(`onBeforeRequest: blockFile: file URL protection is not enabled`);
                return proceed();
            }
            ifIncognitoTab(tabId, () => {
                this.closeTabAndLaunchBrowser(tabId, fileURL);
            });
            this.phishingNavSequenceDetector.resetDetector(tabId);
            const blockedFilePageURL = this.fileBlocker.blockFile(fileURL, tabId);
            return this.redirectNavigation(tabId, blockedFilePageURL);
        };
        const blockUntrustedFile = (fileURL) => {
            log_log(`onBeforeRequest: ${requestId}: blockUntrustedFile`);
            if (!this.featureManager.isFileURLProtectionEnabled) {
                log_log(`onBeforeRequest: blockUntrustedFile: file URL protection is not enabled`);
                return proceed();
            }
            return this.launchBrowserAndCloseTab(tabId, fileURL);
        };
        const isAuthRequest = this.isAuthRequest(srcURL, destURL);
        const isParentPhishingSourceSite = this.isPhishingSourceSite(parentURL);
        const isSrcPhishingSourceSite = this.isPhishingSourceSite(srcURL);
        const isDestPhishingSourceSite = this.isPhishingSourceSite(destURL);
        const isParentWebMailSite = this.isWebMailSite(parentURL);
        const isSrcWebMailSite = this.isWebMailSite(srcURL);
        const isDestWebMailSite = this.isWebMailSite(destURL);
        const shouldBlockNavigation = this.shouldBlockNavigation(isFreshNavSeq, isNewTab, isRedirect, httpMethod, srcURL, parentURL);
        const [isParentTrustedURL] = this.isTrustedURL(parentURL);
        const [isDestTrustedURL, isDestUntrustedURL] = this.isTrustedURL(destURL);
        const isDestUncategorizedURL = (maybe_some(destURL) && !isDestTrustedURL && !isDestUntrustedURL);
        const [isDestFileURL, isDestTrustedFileURL, isDestUntrustedFileURL] = this.isTrustedFileURL(destURL);
        const isDestBlockedPageURL = this.isBlockedPageURL(destURL);
        const isDestBlockedFilePageURL = this.isBlockedFilePageURL(destURL);
        const isDestExternalAppLinkURL = this.isExternalAppLinkURL(destURL);
        const isParentExternalAppLinkURL = this.isExternalAppLinkURL(parentURL);
        const isDestNewTabPageUrl = this.isNewTabPageUrl(destURL);
        const parentGroups = this.findGroups(parentURL);
        const destGroups = this.findGroups(destURL);
        const isSrcSameOrigin = this.isSameOrigin(srcURL, destURL);
        const isParentSameOrigin = this.isSameOrigin(parentURL, destURL);
        const isBlockedPageContinue = this.isBlockedPageContinueNavigation(srcURL, destURL);
        if (isDestExternalAppLinkURL) {
            this.detectedExternalAppLink(tabId);
        }
        const destURLCategories = categorizeUrl(isDestTrustedURL, isDestUntrustedURL, isDestPhishingSourceSite, isDestWebMailSite, isDestExternalAppLinkURL);
        if (isDestBlockedPageURL ||
            isDestBlockedFilePageURL) {
            this.phishingNavSequenceDetector.resetDetector(tabId);
        }
        if (considerParentTab) {
            this.detectedParentTab(tabId, details.timeStamp, parentURL, parentURLCategories, parentGroups);
        }
        const navSequenceDetections = (isRedirect ?
            this.detectPhishingNavSequenceOnRedirect(tabId, details.timeStamp, destURL, destURLCategories, destGroups) :
            this.detectPhishingNavSequenceOnNavigate(tabId, details.timeStamp, destURL, destURLCategories, destGroups, isNewTab, didUserCreateTab, isFreshNavSeq));
        const hasHigherPrecedenceThanBuiltin = this.hasHigherPrecedenceThanBuiltin(navSequenceDetections);
        const shouldAllowNavigation = (navSequenceDetections.shouldAllow ||
            navSequenceDetections.shouldPossiblyAllow ||
            navSequenceDetections.shouldPossiblyBlock) &&
            hasHigherPrecedenceThanBuiltin;
        log_log(`onBeforeRequest(${string_utils_toString({
            requestId: requestId,
            frameId: frameId,
            tabId: tabId,
            parentTabId: parentTabId,
            isNewTab: isNewTab,
            didUserCreateTab: didUserCreateTab,
            considerParentTab: considerParentTab,
            isRestoredSessionTab: isRestoredSessionTab,
            initiator: initiator,
            srcURL: srcURL,
            destURL: destURL,
            parentURL: parentURL,
            isRedirect: isRedirect,
            isAuthRequest: isAuthRequest,
            httpMethod: maybe_some(httpMethod) ? httpMethodTypeToString(httpMethod) : details.method,
            isFreshNavSeq: isFreshNavSeq,
            isSrcPhishingSourceSite: isSrcPhishingSourceSite,
            isDestPhishingSourceSite: isDestPhishingSourceSite,
            isParentPhishingSourceSite: isParentPhishingSourceSite,
            isSrcWebMailSite: isSrcWebMailSite,
            isDestWebMailSite: isDestWebMailSite,
            isParentWebMailSite: isParentWebMailSite,
            isDestTrustedURL: isDestTrustedURL,
            isDestUntrustedURL: isDestUntrustedURL,
            isDestUncategorizedURL: isDestUncategorizedURL,
            isParentTrustedURL: isParentTrustedURL,
            isDestBlockedPageURL: isDestBlockedPageURL,
            isDestBlockedFilePageURL: isDestBlockedFilePageURL,
            isDestExternalAppLinkPageURL: isDestExternalAppLinkURL,
            isParentExternalAppLinkPageURL: isParentExternalAppLinkURL,
            isDestNewTabPageUrl: isDestNewTabPageUrl,
            parentGroups: parentGroups,
            destGroups: destGroups,
            shouldBlockNavigation: shouldBlockNavigation,
            shouldAllowNavigation: shouldAllowNavigation,
            destURLCategories: urlCategoryToString(destURLCategories),
            parentURLCategories: urlCategoryToString(parentURLCategories),
            isSrcSameOrigin: isSrcSameOrigin,
            isParentSameOrigin: isParentSameOrigin,
            isBlockedPageContinue: isBlockedPageContinue,
            isBlockedNavSequence: navSequenceDetections.shouldBlock,
            isPossibleBlockedNavSequence: navSequenceDetections.shouldPossiblyBlock,
            isAllowedNavSequence: navSequenceDetections.shouldAllow,
            isPossibleAllowedNavSequence: navSequenceDetections.shouldPossiblyAllow,
            navSequenceDetectionsPrecedence: navSequenceDetections.precedence,
            hasHigherPrecedenceThanBuiltin: hasHigherPrecedenceThanBuiltin,
        })})`);
        if (isDestBlockedPageURL ||
            isDestBlockedFilePageURL ||
            isDestExternalAppLinkURL ||
            isDestNewTabPageUrl ||
            isBlockedPageContinue) {
            return proceed();
        }
        else if (isDestUntrustedURL) {
            return blockUntrusted(destURL);
        }
        else if (isDestFileURL) {
            if (isDestTrustedFileURL) {
                return proceed();
            }
            else if (isDestUntrustedFileURL) {
                return blockUntrustedFile(destURL);
            }
            else {
                return blockFile(destURL);
            }
        }
        else if (navSequenceDetections.shouldBlock &&
            hasHigherPrecedenceThanBuiltin) {
            return blockWithNavSequence(destURL, navSequenceDetections.blocked);
        }
        else if (navSequenceDetections.shouldAllow &&
            hasHigherPrecedenceThanBuiltin) {
            return proceed();
        }
        else if (this.promptForUncategorized &&
            isDestUncategorizedURL &&
            !isBlockedPageContinue) {
            return blockUncategorized(destURL);
        }
        else if (isNewTab && isRedirect) {
            logError(new Error(`onBeforeRequest: unexpected: ${string_utils_toString({
                destURL: destURL,
                tabId: tabId,
                isNewTab: isNewTab,
                isRedirect: isRedirect
            })}`));
            return proceed();
        }
        else if (isNewTab) {
            if (isRestoredSessionTab) {
                return proceed();
            }
            else if (shouldBlockNavigation &&
                !shouldAllowNavigation &&
                !isDestTrustedURL &&
                !didUserCreateTab &&
                !isParentSameOrigin) {
                return block(destURL);
            }
        }
        else if (isRedirect) {
            if (shouldBlockNavigation &&
                !shouldAllowNavigation &&
                !isAuthRequest &&
                !isDestTrustedURL &&
                !isSrcSameOrigin) {
                return block(destURL);
            }
        }
        else if (shouldBlockNavigation &&
            !navSequenceDetections.shouldAllow &&
            !navSequenceDetections.shouldPossiblyAllow &&
            !isAuthRequest &&
            !isDestTrustedURL &&
            !isSrcSameOrigin) {
            return block(destURL);
        }
        if (navSequenceDetections.shouldBlock &&
            !hasHigherPrecedenceThanBuiltin) {
            return blockWithNavSequence(destURL, navSequenceDetections.blocked);
        }
        else if (navSequenceDetections.shouldAllow &&
            !hasHigherPrecedenceThanBuiltin) {
            return proceed();
        }
        return proceed();
    }
    onBeforeRedirect(details) {
        log_log(`onBeforeRedirect(${string_utils_toString(details)})`);
        this.pendingRedirects.add(details.requestId);
    }
    readContentTypeHeader(headers) {
        if (maybe_none(headers)) {
            return undefined;
        }
        const filteredHeaders = headers.filter((header) => {
            const headerType = parseHeaderType(header.name);
            return headerType === HttpHeaderType.contentType;
        });
        if (filteredHeaders.length !== 1) {
            return undefined;
        }
        const contentTypeHeader = first(filteredHeaders);
        return contentTypeHeader.value;
    }
    readContentType(contentTypeHeader) {
        if (maybe_none(contentTypeHeader)) {
            return undefined;
        }
        return parseContentType(contentTypeHeader);
    }
    isPDFContentType(contentType) {
        if (maybe_none(contentType)) {
            return false;
        }
        return contentType === ContentType.pdf;
    }
    onHeadersReceived(details) {
        const requestId = details.requestId;
        const tabId = details.tabId;
        const url = url_utils_parseUrl(details.url);
        const headers = details.responseHeaders;
        const contentTypeHeader = this.readContentTypeHeader(headers);
        const contentType = this.readContentType(contentTypeHeader);
        const isPDFContentType = this.isPDFContentType(contentType);
        const urlCategories = this.categorizeURL(url);
        const groups = this.findGroups(url);
        const navSequenceDetections = this.detectPhishingNavSequenceOnContentType(tabId, details.timeStamp, url, urlCategories, groups, contentType);
        log_log(`onHeadersReceived: ${string_utils_toString({
            requestId: requestId,
            tabId: tabId,
            url: url,
            contentTypeHeader: contentTypeHeader,
            contentType: maybe_some(contentType) ? contentTypeToString(contentType) : contentTypeHeader,
            isPDFContentType: isPDFContentType,
            urlCategories: urlCategoryToString(urlCategories),
            groups: groups,
            shouldBlock: navSequenceDetections.shouldBlock,
            shouldAllow: navSequenceDetections.shouldAllow,
            shouldPossiblyBlock: navSequenceDetections.shouldPossiblyBlock,
            shouldPossiblyAllow: navSequenceDetections.shouldPossiblyAllow,
        })}`);
        const proceed = () => {
            log_log(`onHeadersReceived: ${requestId}: proceed`);
            return this.continueNavigation();
        };
        const block = (phishingNavSequence) => {
            log_log(`onHeadersReceived: ${requestId}: block`);
            if (!this.featureManager.isPDFProtectionEnabled) {
                log_log(`onHeadersReceived: block: PDF protection is not enabled`);
                return proceed();
            }
            if (this.shouldOpenPhishingLinksInSecureBrowser) {
                if (isPDFContentType) {
                    const backToSrcURL = this.getBackToSrcURL(requestId);
                    return this.launchBrowserAndCloseTabWithContentType(tabId, url, contentTypeHeader, backToSrcURL);
                }
                else {
                    return this.launchBrowserAndCloseTabWithContentType(tabId, url, contentTypeHeader);
                }
            }
            this.phishingNavSequenceDetector.resetDetector(tabId);
            const blockedPageURL = this.blockedPageController.blockContentType(url, contentTypeHeader, phishingNavSequence, tabId);
            return this.redirectNavigation(tabId, blockedPageURL);
        };
        if (navSequenceDetections.shouldBlock) {
            return block(navSequenceDetections.blocked);
        }
        else {
            return proceed();
        }
    }
    onCompleted(details) {
        this.redirectBackToSrcInfo.delete(details.requestId);
        this.notifyOnNavigationCompleteHandlers(details.url);
    }
    onErrorOccurred(details) {
        this.redirectBackToSrcInfo.delete(details.requestId);
    }
    registerOnNavigationHandler(handler) {
        this.onNavigationHandlers.push(handler);
    }
    notifyOnNavigationHandlers(tabId, isFreshNavSeq) {
        for (const handler of this.onNavigationHandlers) {
            handler(tabId, isFreshNavSeq);
        }
    }
    registerOnNavigationCompletedHandler(handler) {
        this.onNavigationCompleteHandlers.push(handler);
    }
    notifyOnNavigationCompleteHandlers(url) {
        for (const handler of this.onNavigationCompleteHandlers) {
            handler(url);
        }
    }
    updateListeners() {
        const updateListener = (gatedWebRequestEvent, shouldRegister) => {
            if (shouldRegister) {
                gatedWebRequestEvent.open();
                log_log(`${gatedWebRequestEvent.name} event gate opened`);
                return true;
            }
            else {
                gatedWebRequestEvent.close();
                log_log(`${gatedWebRequestEvent.name} event gate closed`);
                return false;
            }
        };
        const canUseBlockingWebRequest = this.featureManager.canUseBlockingWebRequest;
        const shouldRegisterListeners = this.shouldRegisterListeners;
        const { isLinkProtectionEnabled, isPDFProtectionEnabled, isFileURLProtectionEnabled } = this.featureManager;
        const blockingProtectionEnabled = (isLinkProtectionEnabled || isPDFProtectionEnabled || isFileURLProtectionEnabled);
        const aNonBlockingFeatureIsEnabled = this.credentialProtectionEnabled || this.urlFilteringEnabled;
        logObject('WebRequestListener.updateListeners', {
            canUseBlockingWebRequest,
            shouldRegisterListeners,
            isLinkProtectionEnabled,
            isPDFProtectionEnabled,
            isFileURLProtectionEnabled,
            blockingProtectionEnabled,
            aNonBlockingFeatureIsEnabled,
        });
        const events = [
            this.eventSource.onBeforeRedirectEvent,
            this.eventSource.onCompletedEvent,
            this.eventSource.onErrorOccurredEvent,
        ];
        let hasRegisteredListeners = false;
        for (const event of events) {
            hasRegisteredListeners = updateListener(event, shouldRegisterListeners && (blockingProtectionEnabled || aNonBlockingFeatureIsEnabled)) || hasRegisteredListeners;
        }
        hasRegisteredListeners = updateListener(this.eventSource.onHeadersReceivedEvent, shouldRegisterListeners && isPDFProtectionEnabled) || hasRegisteredListeners;
        hasRegisteredListeners = updateListener(this.eventSource.onBeforeRequestBlockingEvent, shouldRegisterListeners && blockingProtectionEnabled) || hasRegisteredListeners;
        hasRegisteredListeners = updateListener(this.eventSource.onBeforeRequestEvent, shouldRegisterListeners && !blockingProtectionEnabled && aNonBlockingFeatureIsEnabled) || hasRegisteredListeners;
        if (!hasRegisteredListeners) {
            this.clearState();
        }
        this.hasRegisteredListeners = hasRegisteredListeners;
    }
    registerListeners() {
        this.shouldRegisterListeners = true;
        this.updateListeners();
    }
    unregisterListeners() {
        this.shouldRegisterListeners = false;
        this.updateListeners();
    }
    clearState() {
        this.state = new WebRequestListenerState();
    }
    get pendingRedirects() { return this.state.pendingRedirects; }
    get tabs() { return this.state.tabs; }
    get tabURLs() { return this.state.tabURLs; }
    get redirectBackToSrcInfo() { return this.state.redirectBackToSrcInfo; }
}

;// CONCATENATED MODULE: ./startup.ts









































const start = async () => {
    const messageRouter = new GenericMessageRouter();
    const onConfiguredManager = new OnConfiguredManager();
    const configNotifier = new ConfigNotifier(onConfiguredManager);
    const badgeManager = new BadgeManager();
    const errorHandler = new ErrorHandler(messageRouter, configNotifier, onConfiguredManager);
    const hostHelperChannel = new HelperPortChannel(errorHandler, messageRouter);
    const messageSender = hostHelperChannel.messageSender;
    errorHandler.setup(messageSender, hostHelperChannel);
    logger.addSink(new HelperLogSink(messageSender));
    new MessageLogger(messageRouter, hostHelperChannel);
    const webRequestEventSource = new WebRequestEventSource();
    const cache = new Cache(hostHelperChannel, onConfiguredManager);
    cache.configMessage.getCachedValue().then(message => messageRouter.tryRouteMessage(message));
    new ConfigUpdater(configNotifier, messageSender, messageRouter, hostHelperChannel, onConfiguredManager, cache);
    const featureManager = await SBXFeatureManager.create(configNotifier, errorHandler, cache);
    new HeartbeatController(errorHandler, messageSender, messageRouter, hostHelperChannel);
    const trustedUrlTracker = new TrustedUrlTracker(configNotifier, messageSender, cache);
    const tabStalker = new TabStalker();
    const fileUrlTracker = new FileUrlTracker(messageRouter, messageSender);
    const newTabPageUrlTracker = new NewTabPageUrlTracker(configNotifier);
    const placementManager = new PlacementManager(trustedUrlTracker, fileUrlTracker, newTabPageUrlTracker, configNotifier);
    const browserLauncher = new BrowserLauncher(messageRouter, messageSender);
    browserLauncher.registerEventHandler(event => errorHandler.onBrowserLaunchEvent(event));
    new ContextMenuManager(browserLauncher, placementManager, errorHandler, configNotifier, onConfiguredManager);
    const blockedPageController = new BlockedPageController(trustedUrlTracker, browserLauncher, configNotifier, onConfiguredManager, messageSender);
    const fileBlocker = new FileBlocker(fileUrlTracker, browserLauncher, messageSender, onConfiguredManager);
    const linkProtectionService = new LinkProtectionService(configNotifier, tabStalker);
    const externalAppLinkController = new ExternalAppLinkController(onConfiguredManager, messageSender, linkProtectionService);
    const brandingManager = new BrandingManager(configNotifier, errorHandler);
    new PopupController(messageSender, browserLauncher, configNotifier, brandingManager, featureManager, hostHelperChannel, onConfiguredManager);
    const phishingNavSequenceDetector = new PhishingNavSequenceDetector(configNotifier, tabStalker);
    const downloadTracker = new DownloadTracker(messageSender, featureManager);
    const webRequestListener = new WebRequestListener(configNotifier, tabStalker, placementManager, blockedPageController, fileBlocker, browserLauncher, phishingNavSequenceDetector, externalAppLinkController, featureManager, onConfiguredManager, linkProtectionService, webRequestEventSource);
    const alarmManager = new AlarmManager();
    const phishingCategoryTracker = new PhishingCategoryTracker(configNotifier, messageRouter, messageSender, alarmManager, fileUrlTracker, onConfiguredManager);
    new OptionsController(configNotifier, errorHandler, phishingCategoryTracker, messageSender, onConfiguredManager);
    new HistorySeeder(configNotifier, onConfiguredManager, phishingCategoryTracker);
    const alertHelper = new ControllerAlertHelper(phishingCategoryTracker, hostHelperChannel, phishingNavSequenceDetector, messageSender);
    const urlStatusRequester = new UrlStatusRequester(configNotifier);
    const domainWhoisRequester = new DomainWhoisRequester(configNotifier);
    const urlFilteringManager = new UrlFilteringManager(configNotifier, alarmManager, webRequestListener, urlStatusRequester, domainWhoisRequester, trustedUrlTracker);
    new ContentScriptController(configNotifier, errorHandler, webRequestListener, hostHelperChannel, linkProtectionService, tabStalker, phishingCategoryTracker, onConfiguredManager, messageRouter, messageSender, alertHelper, badgeManager, urlFilteringManager);
    new BrowserSmartScreenTracker(configNotifier, tabStalker, alertHelper);
    const listenerClasses = [tabStalker, downloadTracker, webRequestListener];
    const registerListeners = () => {
        listenerClasses.forEach(cls => cls.registerListeners());
        tabStalker.queryRestoredSessionTabs();
    };
    const unregisterListeners = () => listenerClasses.forEach(cls => cls.unregisterListeners());
    errorHandler.onDormantStateChanged.registerEventHandler(state => {
        if (state.isDormant) {
            unregisterListeners();
        }
        else {
            registerListeners();
        }
    });
    if (maybe_some(currentBrowser)) {
        log_log(`The current browser is ${Browser[currentBrowser]} with userAgent "${navigator.userAgent}"`);
    }
    else {
        logError("Unable to work out the current browser");
    }
    log_log(`WSX version: ${chrome.runtime.getManifest().version}`);
    chrome.runtime.onInstalled.addListener(details => {
        log_log(`onInstalled(${JSON.stringify(details)})`);
    });
    chrome.runtime.onUpdateAvailable.addListener(details => {
        log_log(`onUpdateAvailable(${JSON.stringify(details)})`);
    });
    const manifest = chrome.runtime.getManifest();
    logObject('manifest', manifest);
    const info = await compat.management.getSelf();
    logObject('extensionInfo', info);
    hostHelperChannel.connect();
    registerListeners();
};

;// CONCATENATED MODULE: ./main.ts

function initChromeRuntime() {
    const runtime = chrome.runtime;
}
initChromeRuntime();
start();

})();

/******/ })()
;