class Queue {
    constructor () {
        this.queue = [];
        this.wait = [];

        this.processed = 0;
        this.time = 0;
        this.avg = 0;

        this.actionsTime = {};
/*
        setInterval(() => {
            let actionStats = "";
            for (let actionName in this.actionsTime) {
                const action = this.actionsTime[actionName];

                actionStats += "action: " + actionName + ", " +
                    "time: " + (action.time / (1000 * 60)).toFixed(4) + "m, " + 
                    "counter: " + action.counter + ", " +
                    "running: " + action.running + ", " +
                    "avg: " + ((action.time / (1000 * 60)) / action.counter).toFixed(4) + "m;\n"
                ;

            }

            console.log(`---\nprocessed: ${this.processed}, time: ${this.time};\n${actionStats}---\n`);
            
        }, 1000);*/
    }

    get () {
        return new Promise(resolve => {
            this.wait.push(resolve);
            this.flush();
        });
    }

    put (value) {
        this.queue.push({data: value});
        this.flush();
    }

    flush () {
        /**
         * TODO: catch errors, and send them as callback ?
         */

        while (this.wait.length && this.queue.length) {
            const v = this.queue.shift();
            const w = this.wait.shift();

            v.time = new Date().getTime();

            // console.log("-->" + v.data.action);

            // console.log(JSON.stringify(v));

            const action = this.actionsTime[v.data.action] = this.actionsTime[v.data.action] || {
                time: 0,
                counter: 0,
                running: 0
            };

            action.running++;

            w({
                value: v.data, 
                done: () => {
                    const now = new Date().getTime();
                    const delta = now - v.time;
                    this.processed++;
                    this.time += delta;
                    this.avg = this.time / this.processed;
                    // const totalTime = now - startTime;
                    // const crackTime = totalTime - this.time;
                    // console.log(`${v.data.action}; d=${delta/1000}s; avg=${this.avg/1000}s; p=${this.processed}; t=${this.time/1000}s; tt=${totalTime/1000}s; ct=${crackTime/1000}s`);
                    action.counter++;
                    action.time += delta;
                    action.running--;

                    // action.string = `${v.data.action}; c=${action.counter}; t=${action.time/1000}s; avg=${(action.time/action.counter)/1000}s; d=${delta/1000}s; taskAvg=${this.avg}; processed=${this.processed}`;
                    // console.log("\n\n" + JSON.stringify(this.actionsTime));
                }
            });
        }
        // Nothing to do, just remove it. 
    }
}

module.exports = Queue;
