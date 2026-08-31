(function () {
  globalThis.Fqmail = globalThis.Fqmail || {};

  const colors = Object.freeze([
    "#0f6cbd", "#5c2d91", "#038387", "#ca5010", "#107c10",
    "#8e562e", "#d13438", "#004578", "#744da9", "#986f0b",
  ]);
  const records = Object.freeze([
    ["王若晴", "女"], ["李承远", "男"], ["张语桐", "女"], ["刘知行", "男"],
    ["陈思妍", "女"], ["杨景明", "男"], ["赵安宁", "女"], ["黄子谦", "男"],
    ["周清禾", "女"], ["吴嘉树", "男"], ["徐晚宁", "女"], ["孙亦辰", "男"],
    ["胡静姝", "女"], ["朱星河", "男"], ["高雨薇", "女"], ["林砚舟", "男"],
    ["何沐阳", "男"], ["郭书瑶", "女"], ["马修远", "男"], ["罗心怡", "女"],
    ["梁以宁", "女"], ["宋闻洲", "男"], ["郑嘉怡", "女"], ["谢云川", "男"],
    ["韩知夏", "女"], ["唐予安", "男"], ["冯念慈", "女"], ["于默然", "男"],
    ["董舒窈", "女"], ["萧景澄", "男"], ["程星语", "女"], ["曹昱辰", "男"],
    ["袁清妍", "女"], ["邓嘉言", "男"], ["许南乔", "女"], ["傅时安", "男"],
    ["沈知意", "女"], ["曾远航", "男"], ["彭诗涵", "女"], ["吕泽宇", "男"],
    ["苏锦书", "女"], ["卢景行", "男"], ["蒋念真", "女"], ["崔昊然", "男"],
  ].map(([name, gender]) => Object.freeze({name, gender})));

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value || "")) {
      result ^= character.codePointAt(0);
      result = Math.imul(result, 16777619);
    }
    return result >>> 0;
  }

  function pick(bookId, chapterId) {
    const record = records[hash(`${bookId || ""}:${chapterId || ""}`) % records.length];
    return Object.freeze({
      name: record.name,
      initial: record.name.slice(0, 1),
      color: colors[hash(record.name) % colors.length],
      gender: record.gender,
    });
  }

  globalThis.Fqmail.outlookPersonas = Object.freeze({
    records,
    names: Object.freeze(records.map((record) => record.name)),
    colors,
    pick,
  });
})();
