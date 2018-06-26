describe('XDMoD.Layout', function () {
    describe('Basic Construction tests', function () {
        it('column init and resize', function () {

            var pl = new XDMoD.portalLayout(3);

            var expected_9 = [
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8]
            ];

            expect(pl.get(9)).to.deep.equal(expected_9);

            var expected_5 = [
                [0, 3],
                [1, 4],
                [2],
            ];

            expect(pl.get(5)).to.deep.equal(expected_5);

            var expected_10 = JSON.parse(JSON.stringify(expected_9));
            expected_10[0].push(9);

            expect(pl.get(10)).to.deep.equal(expected_10);
        });

        it('array init and resize', function () {


            var expected_9 = [
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8]
            ];

            var pl = new XDMoD.portalLayout(expected_9);

            // make sure the data was deep copied
            expect(pl.get(9)).to.not.equal(expected_9);

            expect(pl.get(9)).to.deep.equal(expected_9);

            var expected_5 = [
                [0, 3],
                [1, 4],
                [2],
            ];

            expect(pl.get(5)).to.deep.equal(expected_5);
        });
    });

    describe('Basic Movement tests', function () {
        it('move and restore', function () {

            var pl = new XDMoD.portalLayout(3);

            var expected_9 = [
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8]
            ];

            expect(pl.get(9)).to.deep.equal(expected_9);

            pl.move(8, 0, 0);

            var moved = [
                [8, 0, 3, 6],
                [1, 4, 7],
                [2, 5]
            ];

            expect(pl.get(9)).to.deep.equal(moved);

            pl.move(8, 2, 2);

            expect(pl.get(9)).to.deep.equal(expected_9);
        });
    });
});
