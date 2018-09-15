const bytes = require('bytes')

export function createDiskUsageChart (id, archives) {
  console.log(archives)
  var total = archives.reduce((acc, archive) => archive.size + acc, 0)
  var fivePercent = total * 0.05
  var other = 0
  var columns = []
  for (let archive of archives) {
    if (archive.size >= fivePercent) {
      // add to columns
      columns.push([archive.title, archive.size])
    } else {
      // merge into other
      other += archive.size
    }
  }
  columns.push(['Other', other])

  c3.generate({
    bindto: id,
    legend: {position: 'right'},
    size: {height: 400},
    color: {pattern: ['#8bc34a', '#7cb342', '#9ccc65', '#c0ca33', '#c8d23f', '#bcca68']},
    data: {
      columns,
      type: 'donut'
      // onclick: function (d, i) { console.log("onclick", d, i); },
      // onmouseover: function (d, i) { console.log("onmouseover", d, i); },
      // onmouseout: function (d, i) { console.log("onmouseout", d, i); }
    },
    donut: {
      title: 'Disk usage',
      label: {format: (value, ratio, id) => bytes(value)}
    }
  })
}
