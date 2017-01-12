riot.tag2('rd-tree', '<div style="position: absolute; width: 100%; height: 100%; background-color: #fff; opacity: 0.7;"> </div> <div id="tree" style="width: 100%; height: 100%;"></div> <div class="info" if="{showInfo}"> <div class="code {showPrettyClass}"> <div class="title" onclick="{showPretty}"> Pretty Print </div> <div class="code-content pretty" id="prettytext"> </div> </div> <div class="code {showJSONClass}"> <div class="title" onclick="{showJSON}"> JSON </div> <div class="code-content"> <pre id="info"></pre> </div> </div> </div>', '', '', function(opts) {
        var tag = this;
        var cytoscape = require('cytoscape');
        var cy;

        tag.showInfo = false;
        tag.showJSONClass = 'toggle';
        tag.showPrettyClass = '';

        tag.showJSON = function () {
          tag.showJSONClass = tag.showJSONClass==='toggle'?'':'toggle';
        }

        tag.showPretty = function () {
          tag.showPrettyClass = tag.showPrettyClass==='toggle'?'':'toggle';
        }

        tag.on('mount', function () {
            cy = cytoscape({
                container: document.getElementById('tree'),
                elements: opts.data.graph,
                  style: [
                    {
                      selector: 'node',
                      style: {
                        'background-color': '#666',
                        'label': 'data(id)'
                      }
                    },

                    {
                      selector: 'edge',
                      style: {
                        'width': 3,
                        'line-color': '#3f51b5',
                        'target-arrow-color': '#3f51b5',
                        'target-arrow-shape': 'triangle'
                      }
                    }
                  ],

                  layout: {
                    name: 'breadthfirst',
                    roots: [opts.data.root],
                    avoidOverlap: true,
                    maximalAdjustments: 50,
                    animate: true,
                    animationDuration: 3000,
                    directed: true
                  }
            });

            var selectedNode;
            cy.on('tap', 'node', function (evt){
              var branchID = evt.cyTarget.id();
              var branchData = opts.data.branchs[branchID];

              if (selectedNode) {
                selectedNode.style('background-color', '#333');
              }

              selectedNode = evt.cyTarget;
              evt.cyTarget.style('background-color', 'red');

              var info = JSON.stringify(branchData, null, '\t');

              console.log( branchData.metadata.prettyText.replace(/\n/g, '<br>'));
              tag.prettytext.innerHTML = branchData.metadata.prettyText
                .replace(/\n/g, '<br>')
                .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');

              tag.showInfo = info.length > 0;
              tag.info.innerHTML = info;
              tag.update();
            });
        });

        tag.on('unmount', function () {
          cy.off('tap');
        });

});