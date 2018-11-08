class Queue {
    constructor () {
        this.queue = [];
        this.wait = [];

        this.processed = 0;
        this.time = 0;
        this.avg = 5000;
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
        while (this.wait.length && this.queue.length) {
            const v = this.queue.shift();
            const w = this.wait.shift();

            v.time = new Date().getTime();
 
            w({
                value: v.data, 
                done: () => {
                    const delta = new Date().getTime() - v.time;
                    this.processed++;
                    this.time += delta;
                    this.avg = this.time / this.processed;
                }
            });
        }
        // Nothing to do, just remove it. 
    }
}

module.exports = Queue;
