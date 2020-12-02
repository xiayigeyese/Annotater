## 服务端

服务端默认监听在 9001 端口，使用 WebSocket 协议通信，协议数据使用 JSON 格式封装，如果为图像数据则直接传递二进制数据。

## 消息通信

### 1. 客户端请求已有的数据集列表

```JSON
{
  "type": "datasets"
}
```

服务端返回结果

```JSON
{
  "type": "datasets",
  "data": [
    {
      "id": "123456",
      "name": "2121",
      "dimensions": [100, 100, 50]
    },
    {
      "id": "123456",
      "name": "12123",
      "dimensions": [100, 100, 50]
    }
  ]
}
```

### 2. 客户端请求体数据切片数据

```JSON
{
  "type": "slice",
  "dataset": "123456",
  "axis": "x",
  "indexes": [100, 101]
}
```

服务端返回结果：二进制图像内容

### 3. 客户端提交标注信息

```JSON
{
  "type": "annotation",
  // 剩余部分见下一节[标注数据的编码]中的Annotation类型
}
```

正常情况服务端无返回结果

### 4. 服务端返回报错

如果某个操作在服务端出现错误，将返回如下错误信息

```JSON
{
  "type": "error",
  "data": "错误信息"
}
```

---

## 标注数据的编码

### 1. 基本结构

```ts
// 通信
type Annotation = {
  dataset: string;
  axis: "x" | "y" | "z";
  index: number;
  annotations: Array<{
    tag: number;
    comment: string;
    type: "Rect" | "Polygon";
    // 通常coordinates数组只有一个元素
    // 当coordinates数组有多个元素时，即表示带内部空洞的框标注，第一个元素表示外环，剩余元素均为内环
    coordinates: Array<[number, number, number, number]> | coordinates: Array<Array<number>>;
  }>;
};
```

### 2. 示例

如下示例，xn, yn 表示某点的 x, y 坐标，tag 表示类别，comment 为备注。

同一数据集，不同切片的 tag 值相同即表示同一类别。

```js
{
  dataset: "123456",
  axis: "x",
  index: 50,
  annotations: [
    {
      tag: 1,
      comment: "这是XXXX",
      type: "Polygon",
      coordinates: [
        [x1, y1, x2, y2, ..., xn, yn]
      ]
    },
    {
      tag: 2,
      comment: "这是XXXX",
      type: "Polygon",
      // 多组points，第一个数组表示外环，剩余表示内环
      coordinates: [
        [x1, y1, x2, y2, ..., xn, yn],
        [x1, y1, x2, y2, ..., xn, yn],
        [x1, y1, x2, y2, ..., xn, yn]
      ]
    }，
    {
      tag: 2,
      comment: "这是XXXX",
      type: "Rect",
      // 多组points，第一组表示外框，剩余表示内框
      coordinates: [
        [x1, y1, x2, y2]
      ]
    }
  ]
}
```
