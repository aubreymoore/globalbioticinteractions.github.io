(function(pub) {
    d3.selection.prototype.moveToFront = function() {
        return this.each(function(){
            this.parentNode.appendChild(this);
        });
    };

    var config = {
            dimensions: {
                width: 600,
                height: 300
            },
            arrow: {
                width: 3,
                length: 7
            },
            stroke_width: {
                normal: 0.8,
                active: 1.5
            },
            color: {
                circle: '#69f',
                active: {
                    circle: '#6c6'
                }
            },
            opacity: {
                normal: 0.6,
                active: 1
            }
        },
        translate = [0, 0],
        scale = 1,
        force, chart, link, links, node, nodes;

    function init(data, canvasDimension) {
        config.dimensions.width = canvasDimension.width;
        config.dimensions.height = canvasDimension.height;

        force = d3.layout.force()
            .gravity(.07)
            .distance(20)
            .charge(-200)
            .linkDistance(60)
            .linkStrength(.3)
            .size([config.dimensions.width, config.dimensions.height])
            .on('tick', tick);

        chart = d3.select('#hairball-container').append('svg:svg')
            .attr('width', config.dimensions.width * 2)
            .attr('height', config.dimensions.height * 2)
            .attr('pointer-events', 'all')
            .append('svg:g')
            .call(d3.behavior.zoom().on('zoom', redraw))
            .append('svg:g');

        chart.append('svg:rect')
            .attr('width', config.dimensions.width * 4)
            .attr('height', config.dimensions.height * 4)
            .attr('transform', 'translate(-' + config.dimensions.width * 2 + ',-' + config.dimensions.height * 2 + ')')
            .attr('fill', '#b7b7b7');

        var defs = chart.append('svg:defs');
        defs.append('svg:marker')
            .attr('id', 'arrowGray')
            .attr('viewBox', '0 0 ' + config.arrow.length + ' ' + config.arrow.width)
            .attr('refX', config.arrow.length)
            .attr('refY', config.arrow.width / 2)
            .attr('markerUnits', 'userSpaceOnUse')
            .attr('markerWidth', config.arrow.length + 2)
            .attr('markerHeight', config.arrow.width + 2)
            .attr('orient', 'auto')
            .append('svg:path')
            .attr('d', 'M 0 0 L ' + config.arrow.length + ' ' + (config.arrow.width / 2) + ' L 0 ' + config.arrow.width + ' z')
            .attr('fill', '#888');

        link = chart.selectAll('.link');
        node = chart.selectAll('.node');
        links = [];
        nodes = [];

        parseInteractions(data);
    }

    function update() {
        force
            .nodes(nodes)
            .links(links)
            .start();

        link = link.data(links);

        link.exit().remove();

        link.enter().insert('line', '.node')
            .attr('class', 'link')
            .attr('marker-end', 'url(#arrowGray)')
            .attr('link_id', function(d) { return d['link_id'];})
            .style('opacity', config.opacity.normal)
            .style('stroke-width', config.stroke_width.normal)
            .on('mouseover', linkMouseover)
            .on('mouseout', linkMouseout)
            .on('click', linkClick);

        node = node.data(nodes);

        node.exit().remove();

        var nodeEnter = node.enter().append('g')
            .attr('class', 'node')
            .attr('eolid', function(d) {return d['id']})
            .on('touchstart', function() { d3.event.stopPropagation(); })
            .on('mousedown', function() { d3.event.stopPropagation(); })
            .on('click', nodeClick)
            .on('mouseover', nodeMouseover)
            .on('mouseout', nodeMouseout)
            .attr('opacity', config.opacity.normal)
            .call(force.drag);

        nodeEnter.append('circle')
            .attr('r', 3);

        nodeEnter.append('text')
            .attr('dy', '.35em')
            .attr('dx', '.35em')
            .text(function(d) { return d['name']; }).style('display', 'none').attr('shown', false);

        node.select('circle')
            .style('fill', config.color.circle);
    }

    function tick() {
        link.attr('x1', function(d) { return d.source.x; })
            .attr('y1', function(d) { return d.source.y; })
            .attr('x2', function(d) { return d.target.x; })
            .attr('y2', function(d) { return d.target.y; });

        node.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
    }

    function redraw() {
        translate = d3.event.translate;
        scale = d3.event.scale;
        chart.attr('transform', 'translate(' + translate + ')' + ' scale(' + scale + ')');
    }

    function parseInteractions(data) {
        var nodeCache = {}, index = 0, interaction, source, target, sourceId, targetId, linkId, linkCache = {}, i;
        for (i = 0; interaction = data[i]; i++) {
            source = interaction['source'];
            source['id'] = source['id'].replace(':', '_');
            sourceId = source['id'];
            target = interaction['target'];
            target['id'] = target['id'].replace(':', '_');
            targetId = target['id'];

            if ((sourceId !== 'no_match') && !nodeCache[sourceId]) {
                nodeCache[sourceId] = source;
                nodeCache[sourceId]['index'] = index++;
            }
            if ((targetId !== 'no_match') && !nodeCache[targetId]) {
                nodeCache[targetId] = target;
                nodeCache[targetId]['index'] = index++;
            }

            if (
                (sourceId !== 'no_match') &&
                (targetId !== 'no_match') &&
                (sourceId !== targetId)
            ) {
                linkId = sourceId + '---' + targetId;
                if (!linkCache[linkId]) {
                    linkCache[linkId] = {
                        source: nodeCache[sourceId]['index'],
                        target: nodeCache[targetId]['index'],
                        link_id: linkId
                    };
                }
            }
        }

        for (var link in linkCache) {
            if (linkCache.hasOwnProperty(link)) {
                links.push(linkCache[link]);
            }
        }

        for (var node in nodeCache) {
            if (nodeCache.hasOwnProperty(node)) {
                nodes.push(nodeCache[node]);
            }
        }

        update();
    }

    function nodeMouseover(d) {
        var $this = d3.select(this);
        $this.attr('opacity', config.opacity.active);
    }

    function nodeMouseout(d) {
        var $this = d3.select(this);
        $this.attr('opacity', config.opacity.normal);
    }

    function nodeClick(d) {
        if (d3.event.defaultPrevented) return;
        toggleNode(d3.select(this));
    }

    function linkMouseover(d) {
        var $this = d3.select(this);
        var linkdId = d['link_id'];
        var nodes = linkdId.split('---');
        var sourceNode = d3.select('[eolid=' + nodes[0] + ']');
        var targetNode = d3.select('[eolid=' + nodes[1] + ']');
        sourceNode.attr('opacity', config.opacity.active);
        targetNode.attr('opacity', config.opacity.active);
        $this.attr('opacity', config.opacity.active);
        $this.style('stroke-width', config.stroke_width.active);
    }

    function linkMouseout(d) {
        var $this = d3.select(this);
        var linkdId = d['link_id'];
        var nodes = linkdId.split('---');
        var sourceNode = d3.select('[eolid=' + nodes[0] + ']');
        var targetNode = d3.select('[eolid=' + nodes[1] + ']');
        sourceNode.attr('opacity', config.opacity.normal);
        targetNode.attr('opacity', config.opacity.normal);
        $this.attr('opacity', config.opacity.normal);
        $this.style('stroke-width', config.stroke_width.normal);
    }

    function linkClick(d) {
        if (d3.event && d3.event.defaultPrevented) return;
        var linkdId = d['link_id'];
        var nodes = linkdId.split('---');
        var sourceNode = d3.select('[eolid=' + nodes[0] + ']');
        var targetNode = d3.select('[eolid=' + nodes[1] + ']');
        var formerSourceStatus = toggleNode(sourceNode);
        toggleNode(targetNode, formerSourceStatus);
    }

    function toggleNode(node, forcedStatus) {
        forcedStatus = forcedStatus || '';
        var $this = node;
        var text = $this.select("text");
        var circle = $this.select("circle");
        var shown = text.attr('shown');
        if (forcedStatus !== '') {
            shown = forcedStatus;
        }
        if (shown === 'false') {
            text.style('display', 'block');
            text.attr('shown', true);
            circle.style('fill', config.color.active.circle);
            $this.attr('opacity', config.opacity.active);
            $this.moveToFront();
        } else {
            text.style('display', 'none');
            text.attr('shown', false);
            circle.style('fill', config.color.circle);
            $this.attr('opacity', config.opacity.normal);
        }
        return shown;
    }

    pub.buildHairball = init;
    pub.highlightHB = linkClick;
})(window);