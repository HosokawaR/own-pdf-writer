class IdGenerator {
  private id = 0;

  generate = () => {
    this.id += 1;
    return this.id;
  };
}

const idGenerator = new IdGenerator();

type RenderResult = { result: string; followers: ObjWrapper[] };

interface Obj {
  render: () => RenderResult;
}

// offset, generation
const crossReference: [number, number][] = [];

const capture = (renderResult: RenderResult): RenderResult => {
  const offset = crossReference.at(-1)?.[0] ?? 0;
  crossReference.push([offset + renderResult.result.length, 0]);
  return renderResult;
};

class ObjWrapper {
  constructor(private readonly id: number, private readonly obj: Obj) {}

  renderRef = () => {
    return `${this.id} 0 R`;
  };

  render = (): string => {
    const rendered = this.obj.render();

    return `
${this.id} 0 obj
${rendered.result}
endobj
${rendered.followers.map((follower) => follower.render()).join("\n")}
`;
  };
}

class Dictionary {
  constructor(private readonly pairs: Array<[string, unknown]>) {}

  render = () => {
    return `<<${this.pairs
      .map(([key, value]) => `${key} ${value}\n`)
      .join(" ")}>>`;
  };
}

// private crossReference: CrossReference,
// private trailer: Trailer
class PDF {
  constructor(private header: Header, private catalog: Catalog) {}

  rendoer = () => {
    const id = idGenerator.generate();
    const catalogObj = new ObjWrapper(id, this.catalog);

    return `
${this.header.render()}
${catalogObj.render()}
xref 
0 ${crossReference.length}
${crossReference
  .map(
    ([offset, generation]) =>
      String(offset).padStart(10, '0') + " " + String(generation).padStart(5, '0') + " n"
  )
  .join("\n")}
trailer
<<
  /Size ${crossReference.length}
  /Root ${catalogObj.renderRef()}
>>
startxref
${crossReference.at(-1)?.[0]}
%%EOF
`;
  };
}

class Header {
  constructor() {}

  render = () => {
    return `%PDF-1.3`;
  };
}

class Catalog {
  constructor(
    private readonly pages: Pages,
    private readonly outlines: Outlines
  ) {}

  render = () => {
    const pagesObj = new ObjWrapper(idGenerator.generate(), this.pages);
    const outlinesObj = new ObjWrapper(idGenerator.generate(), this.outlines);

    return capture({
      result: new Dictionary([
        ["/Type", "/Catalog"],
        ["/Pages", pagesObj.renderRef()],
      ]).render(),
      followers: [pagesObj, outlinesObj],
    });
  };
}

class Pages implements Obj {
  private readonly count: number;

  constructor(private readonly kids: Array<Page>) {
    this.count = kids.length;
  }

  render = () => {
    const kidObjs = this.kids.map(
      (kid) => new ObjWrapper(idGenerator.generate(), kid)
    );

    return capture({
      result: new Dictionary([
        ["/Type", "/Pages"],
        ["/Count", this.count],
        ["/Kids", `[${kidObjs.map((kid) => kid.renderRef()).join(" ")}]`],
      ]).render(),
      followers: kidObjs,
    });
  };
}

class Page implements Obj {
  constructor(
    private readonly contents: Contents,
    private readonly resources: Resources
  ) {}

  render = () => {
    const contentsObj = new ObjWrapper(idGenerator.generate(), this.contents);
    const resourcesObj = new ObjWrapper(idGenerator.generate(), this.resources);

    return capture({
      result: new Dictionary([
        ["/Type", "/Page"],
        // Parent は出さない
        ["/MediaBox", "[0 0 612 792]"],
        ["/Contents", contentsObj.renderRef()],
        // ["/Resources", resourcesObj.renderRef()],
        // disctory で出す
        ["/Font", this.resources.render()],
      ]).render(),
      followers: [contentsObj, resourcesObj],
    });
  };
}

class Outlines implements Obj {
  constructor(private readonly count: number) {}

  render = () => {
    return capture({ result: new Dictionary([]).render(), followers: [] });
  };
}

class Contents implements Obj {
  constructor(private readonly stream: string) {}

  render = () => {
    return capture({
      result: `
<< /Length ${this.stream.length} >>
stream
${this.stream}
endstream
`,
      followers: [],
    });
  };
}

class Resources implements Obj {
  constructor(private readonly font: Font[]) {}

  render = () => {
    const fontObjs = this.font.map((font) => {
      const id = idGenerator.generate();
      return new ObjWrapper(id, font);
    });

    return capture({
      result: new Dictionary([
        ["/Font", `[${fontObjs.map((font) => font.renderRef()).join(" ")}]`],
      ]).render(),
      followers: fontObjs,
    });
  };
}

class Font {
  constructor(
    private readonly subtype: string,
    private readonly name: string,
    private readonly baseFont: string,
    private readonly encoding: string
  ) {}

  render = () => {
    return capture({
      result: new Dictionary([
        ["/Type", "/Font"],
        ["/Subtype", this.subtype],
        ["/Name", `/${this.name}`],
        ["/BaseFont", `/${this.baseFont}`],
        ["/Encoding", `/${this.encoding}`],
      ]).render(),
      followers: [],
    });
  };
}

class Footer {
  constructor() {}
}

class CrossReference {
  constructor(private readonly catalog: Catalog) {}

  render = () => {
    // const;
  };
}

class Trailer {
  constructor() {}
}

const header = new Header();

const pages = new Pages([
  new Page(
    new Contents(`BT /F1 24 Tf 100 100 Td (Hello, World!) Tj ET`),
    new Resources([new Font("Type0", "F1", "TimesNewRoman", "UniJIS-UCS2-H")])
  ),
]);
const outlines = new Outlines(0);

const catalog = new Catalog(pages, outlines);

// const crossReference = new CrossReference();
// const trailer = new Trailer();

const pdf = new PDF(header, catalog);
console.log(pdf.rendoer());
