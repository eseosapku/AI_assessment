"""Placing a point's label on a graph where nothing else is (P6 maths, AL part): the first of a list of offsets at which
the label lies inside the axes, crosses no drawn line (curve, tangent, asymptote), neither axis line, no other label and
no axis number. Used by hyperbolic_graph and exp_tangent."""
from __future__ import annotations


def _hits(box, pts, pad=2.0) -> bool:
    """Whether a polyline (in pixels) passes through a box, sampling each segment finely."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = max(2, int(max(abs(x1 - x0), abs(y1 - y0)) / 2))
        for k in range(steps + 1):
            x, y = x0 + (x1 - x0) * k / steps, y0 + (y1 - y0) * k / steps
            if box.x0 - pad < x < box.x1 + pad and box.y0 - pad < y < box.y1 + pad:
                return True
    return False


def place(fig, ax, x: float, y: float, text: str, tries, gid: str, fontsize: float = 11, weight: str = "normal"):
    """Writes text beside the point (x, y) at the first clear offset in `tries` ((dx, dy) in points, ha, va); the last
    is kept if none is clear. Returns the text."""
    fig.canvas.draw()
    renderer = fig.canvas.get_renderer()
    frame = ax.get_window_extent(renderer)
    lines = [ln.get_transform().transform(ln.get_xydata()) for ln in ax.lines if len(ln.get_xydata()) > 1]
    others = [t.get_window_extent(renderer) for t in ax.texts]
    others += [t.get_window_extent(renderer) for t in ax.get_xticklabels() + ax.get_yticklabels() if t.get_text()]
    ox, oy = ax.transData.transform((0, 0))
    (lx, hx), (ly, hy) = ax.get_xlim(), ax.get_ylim()
    t = None
    for dx, dy, ha, va in tries:
        if t is not None:
            t.remove()
        t = ax.annotate(text, (x, y), xytext=(dx, dy), textcoords="offset points", ha=ha, va=va, fontsize=fontsize,
                        fontweight=weight)
        t.set_gid(gid)
        box = t.get_window_extent(renderer)
        clear = (frame.x0 + 2 < box.x0 and box.x1 < frame.x1 - 2 and frame.y0 + 2 < box.y0 and box.y1 < frame.y1 - 2
                 and not any(_hits(box, pts) for pts in lines)
                 and not (lx < 0 < hx and box.x0 - 2 < ox < box.x1 + 2)
                 and not (ly < 0 < hy and box.y0 - 2 < oy < box.y1 + 2)
                 and not any(min(box.x1, b.x1) - max(box.x0, b.x0) > -2 and min(box.y1, b.y1) - max(box.y0, b.y0) > -2
                             for b in others))
        if clear:
            break
    return t


def ring(r: float = 8.0, far: float = 18.0):
    """Offsets all round a point, near ones first: right, upper right, up, ... and then further out."""
    out = []
    for d in (r, far, 2 * far):
        for dx, dy, ha, va in ((1, 0, "left", "center"), (1, -1, "left", "top"), (1, 1, "left", "bottom"),
                               (-1, -1, "right", "top"), (-1, 1, "right", "bottom"), (-1, 0, "right", "center"),
                               (0, -1, "center", "top"), (0, 1, "center", "bottom")):
            out.append((dx * d, dy * d, ha, va))
    return out
