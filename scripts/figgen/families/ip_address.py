"""IPv4 addressing (AL, UP): a Kigali school's LAN, drawn either as a network diagram (the internet, a router, a switch
and three to five devices, each with its IPv4 address) or as a table of devices and addresses, with the subnet mask in
dotted decimal and as a prefix. Upper secondary draws whole-class masks (/24 and /16); A level subnets (/24 to /28).

Three sub-types: "clean" (every address is a usable host address of the router's subnet), "offnet" (one device has
an address of a neighbouring subnet) and "invalid" (one device has the subnet's network or broadcast address, or an
octet past 255). The network address of a device's subnet, how many usable host addresses the subnet has, and which
device is on another subnet, which address cannot be used, or which address a new device could be given.

Every key is the address and the mask worked out: the network address is the address AND the mask, and a subnet of
prefix n has 2^(32 - n) - 2 usable host addresses (the stem says why two are lost).
"""
from __future__ import annotations

import ipaddress
import random

from matplotlib.patches import Ellipse, FancyBboxPatch, Rectangle

from ..core import INK, NAMES, mcq, new_figure, short

ID = "ip_address"
KIND = "cs.structure"
SUBJECT = "computing"
BANDS = ("AL", "UP")
CONCEPTS = tuple(f"computing.{c}" for c in ("ip-address", "internet-infrastructure"))
# A topic whose sections the book lists is reached only if one names IP addressing (an IGCSE ICT chapter on networks
# teaches no subnets).
NEEDS = r"\bip\b|ip address|addressing|tcp/ip|subnet|router|internet technolog|internet infrastructure"
AVOID = r"database|spreadsheet|security|safety|graphic|\bpresentation|e-?mail|python|html|logic|programming|social media|web|digital divide"
PLACES = ["Remera", "Kimironko", "Nyamirambo", "Kacyiru", "Gikondo", "Kicukiro", "Kanombe", "Gisozi", "Kagugu", "Nyarutarama"]
DEVICES = ["Office PC", "Lab PC 1", "Lab PC 2", "Library PC", "Printer", "File server", "Staff laptop", "Bursar PC",
           "Head's PC", "Tablet"]
THINGS = ["laptop", "printer", "tablet", "projector", "PC"]
PUBLIC = ["41.186", "197.243", "105.178", "41.74"]  # internet-side addresses as Rwandan providers hand them out
FILL = "#eef1f3"
LIGHT = "#d9dee3"


def _net(rng: random.Random, band: str) -> ipaddress.IPv4Network:
    if band == "UP":
        if rng.random() < 0.65:
            return ipaddress.ip_network(f"192.168.{rng.randint(2, 250)}.0/24")
        return ipaddress.ip_network(f"172.{rng.randint(17, 30)}.0.0/16")
    prefix = rng.choice([24, 25, 26, 26, 27, 27, 28])
    size = 2 ** (32 - prefix)
    base = rng.choice([f"192.168.{rng.randint(2, 250)}.", f"10.{rng.randint(1, 250)}.{rng.randint(2, 250)}.",
                       f"172.{rng.randint(17, 30)}.{rng.randint(2, 250)}."])
    return ipaddress.ip_network(f"{base}{rng.randrange(0, 256, size)}/{prefix}")


def _neighbour(net: ipaddress.IPv4Network, rng: random.Random) -> ipaddress.IPv4Network:
    """The subnet just above or below, of the same size: the next /24 or /16 along, or a subnet's neighbour inside its
    own /24 block (so it stays private)."""
    size = net.num_addresses
    step = rng.choice([1, -1])
    if net.prefixlen > 24:
        block = int(net.network_address) & ~0xFF
        if not block <= int(net.network_address) + step * size < block + 256:
            step = -step
    return ipaddress.ip_network((int(net.network_address) + step * size, net.prefixlen))


def _host(net, rng: random.Random, used: set) -> str:
    first, last = int(net.network_address) + 1, int(net.broadcast_address) - 1
    while True:
        a = str(ipaddress.ip_address(rng.randint(first, last)))
        if a not in used:
            used.add(a)
            return a


def sample(rng: random.Random) -> dict:
    band = rng.choice(BANDS)
    net = _net(rng, band)
    router = str(net.network_address + 1) if rng.random() < 0.6 else str(net.broadcast_address - 1)
    used = {router}
    names = rng.sample(DEVICES, rng.randint(3, 5))
    hosts = [[d, _host(net, rng, used)] for d in names]
    mode = rng.choice(["clean", "offnet", "invalid"])
    odd = None
    if mode != "clean":
        i = rng.randrange(len(hosts))
        odd = hosts[i][0]
        if mode == "offnet":
            other = _neighbour(net, rng)
            hosts[i][1] = _host(other, rng, used)
        elif band == "UP" and rng.random() < 0.5:  # a typing slip: an octet past 255
            parts = hosts[i][1].split(".")
            parts[3 if net.prefixlen == 24 else 2] = str(rng.randint(256, 299))
            hosts[i][1] = ".".join(parts)
        else:
            hosts[i][1] = str(rng.choice([net.network_address, net.broadcast_address]))
    ask = rng.choice([d for d, _ in hosts if d != odd])
    wan = f"{rng.choice(PUBLIC)}.{rng.randint(1, 254)}.{rng.randint(2, 253)}"
    return {"band": band, "view": rng.choice(["diagram", "table"]), "place": rng.choice(PLACES), "prefix": net.prefixlen,
            "router": router, "wan": wan, "hosts": hosts, "mode": mode, "odd": odd, "ask": ask}


def network(p: dict) -> ipaddress.IPv4Network:
    return ipaddress.ip_network(f"{p['router']}/{p['prefix']}", strict=False)


def _mask_text(p: dict) -> str:
    return f"Subnet mask: {network(p).netmask}  (/{p['prefix']})"


def _box(ax, x, y, w, h, label, gid=None, fill=FILL, size=9.5):
    ax.add_patch(FancyBboxPatch((x - w / 2, y - h / 2), w, h, boxstyle="round,pad=0.04", facecolor=fill, edgecolor=INK,
                                linewidth=1.2, zorder=3))
    ax.text(x, y, label, ha="center", va="center", fontsize=size, fontweight="bold", zorder=4, gid=gid)


def _line(ax, a, b):
    ax.plot([a[0], b[0]], [a[1], b[1]], color=INK, linewidth=1.3, zorder=2)


def _diagram(p: dict):
    W, H, k = 10.6, 7.8, 0.78
    fig, ax = new_figure(W * k, H * k)
    ax.set_position([0, 0, 1, 1])
    cx = W / 2
    ax.text(cx, 7.4, f"School LAN, {p['place']}, Kigali", ha="center", va="center", fontsize=12.5, fontweight="bold")
    ax.add_patch(Ellipse((cx, 6.35), 2.6, 0.85, facecolor="white", edgecolor=INK, linewidth=1.2, zorder=3))
    ax.text(cx, 6.35, "Internet", ha="center", va="center", fontsize=10.5, fontstyle="italic", zorder=4)
    _line(ax, (cx, 5.92), (cx, 5.05))
    ax.text(cx + 0.2, 5.5, f"Public address: {p['wan']}", ha="left", va="center", fontsize=9)
    _box(ax, cx, 4.75, 1.6, 0.6, "Router", fill=LIGHT)
    ax.text(cx + 1.0, 4.88, p["router"], ha="left", va="center", fontsize=9.5, family="monospace", gid="addr:the router")
    ax.text(cx + 1.0, 4.55, "(default gateway)", ha="left", va="center", fontsize=8.5)
    _line(ax, (cx, 4.45), (cx, 3.7))
    _box(ax, cx, 3.45, 1.6, 0.5, "Switch", fill=LIGHT)
    hosts = p["hosts"]
    n = len(hosts)
    gap = min(2.1, (W - 1.0) / n)
    for i, (name, addr) in enumerate(hosts):
        x = cx + (i - (n - 1) / 2) * gap
        _line(ax, (cx, 3.2), (x, 1.98))
        _box(ax, x, 1.7, 1.7, 0.55, name, gid=f"name:{name}", size=9)
        ax.text(x, 1.1, addr, ha="center", va="center", fontsize=9.5, family="monospace", gid=f"addr:{name}")
    ax.text(cx, 0.4, _mask_text(p), ha="center", va="center", fontsize=10.5, fontweight="bold", gid="mask")
    ax.set_xlim(0, W)
    ax.set_ylim(0, H)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def _table(p: dict):
    widths, rh = [4.0, 3.4], 0.55
    rows = [["Router (default gateway)", p["router"], "the router"]] + [[d, a, d] for d, a in p["hosts"]]
    width = sum(widths)
    top = rh * (len(rows) + 1)
    k = 0.66
    fig, ax = new_figure((width + 0.6) * k, (top + 2.2) * k)
    ax.set_position([0, 0, 1, 1])
    ax.text(width / 2, top + 0.95, f"School LAN, {p['place']}, Kigali", ha="center", va="center", fontsize=12.5, fontweight="bold")
    ax.text(width / 2, top + 0.4, "Devices and their IPv4 addresses", ha="center", va="center", fontsize=10)
    x = 0.0
    for c, (h, w) in enumerate(zip(["Device", "IPv4 address"], widths)):
        ax.add_patch(Rectangle((x, top - rh), w, rh, facecolor=LIGHT, edgecolor=INK, linewidth=1.0))
        ax.text(x + 0.15, top - rh / 2, h, ha="left", va="center", fontsize=10.5, fontweight="bold")
        for i, (name, addr, key) in enumerate(rows):
            y = top - rh * (i + 2)
            ax.add_patch(Rectangle((x, y), w, rh, facecolor="white", edgecolor=INK, linewidth=0.8))
            if c == 0:
                ax.text(x + 0.15, y + rh / 2, name, ha="left", va="center", fontsize=10,
                        gid=None if key == "the router" else f"name:{name}")
            else:
                ax.text(x + 0.15, y + rh / 2, addr, ha="left", va="center", fontsize=10.5, family="monospace", gid=f"addr:{key}")
        x += w
    ax.text(0, -0.45, _mask_text(p), ha="left", va="center", fontsize=10.5, fontweight="bold", gid="mask")
    ax.set_xlim(-0.3, width + 0.3)
    ax.set_ylim(-0.9, top + 1.3)
    ax.set_aspect("equal")
    ax.axis("off")
    return fig


def draw(p: dict):
    return _diagram(p) if p["view"] == "diagram" else _table(p)


VERBS = ["is setting up", "checks", "is documenting", "troubleshoots", "draws up the plan of", "audits", "maintains"]
SETTINGS = ["in a networking lesson", "for homework", "on a revision card", "for the school's ICT club", "for a class test",
            "during the holidays", "for the bursar"]


def questions(p: dict, rng: random.Random) -> list:
    who, friend = rng.sample(NAMES, 2)
    net = network(p)
    hosts = dict(p["hosts"])
    dev = p["ask"]
    addr = str(ipaddress.ip_network(f"{hosts[dev]}/{p['prefix']}", strict=False).network_address)
    usable = net.num_addresses - 2
    qs = [short(f"{who} {rng.choice(VERBS)} the school network {rng.choice(SETTINGS)}. What is the network address of the "
                f"subnet that the device labelled {dev} is on?", addr, [f"{addr}/{p['prefix']}"]),
          short("How many usable host addresses does this subnet have? (The network address and the broadcast address "
                "cannot be given to a host.)", usable, [f"{usable} hosts", f"{usable} addresses"])]
    others = [d for d in hosts if d != p["odd"]]
    if p["mode"] == "offnet":
        qs.append(mcq(f"{friend} finds that one device cannot reach the router directly. Which device is not on the same "
                      f"subnet as the router?", p["odd"], rng.sample(others, len(others)), rng))
    elif p["mode"] == "invalid":
        qs.append(mcq(f"{friend} spots a mistake in the addresses. Which device has been given an address that cannot be "
                      f"used by any host on this subnet?", p["odd"], rng.sample(others, len(others)), rng))
    else:
        used = set(hosts.values()) | {p["router"]}
        first, last = int(net.network_address) + 1, int(net.broadcast_address) - 1
        while True:
            new = str(ipaddress.ip_address(rng.randint(first, last)))
            if new not in used:
                break
        other = _neighbour(net, rng)
        outside = str(ipaddress.ip_address(rng.randint(int(other.network_address) + 1, int(other.broadcast_address) - 1)))
        wrong = [str(net.network_address), str(net.broadcast_address), rng.choice(sorted(hosts.values())), outside]
        thing = rng.choice(THINGS)
        qs.append(mcq(f"{friend} adds a {thing} to this subnet. Which address could be given to a new {thing} on this subnet?",
                      new, rng.sample(wrong, 3), rng))
    return qs
