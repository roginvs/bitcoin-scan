import { cast, Nominal } from "./nominaltypes";

describe("Nominal types", () => {
  it(`Checking typing system`, () => {
    type LOL = Nominal<"lol", string>;
    type KEK = Nominal<"kek", string>;

    let lol1 = cast<LOL>("some string");
    // @ts-expect-error Because number is not part of string
    const lol2 = cast<KEK>(123);

    function getString(s: string) {
      //
    }
    getString(lol1); // Accepting strings works

    const kek1 = "kekekeke";
    let kek2 = cast<KEK>(kek1);

    // @ts-expect-error Nominal typing preventing this
    kek2 = lol1;

    // The same effect
    let lol3 = "somestring2" as LOL;
    lol3 = lol1;
    lol1 = lol3;

    // @ts-expect-error Because numbers is not a string
    let lol4 = 123 as LOL;
  });
});
