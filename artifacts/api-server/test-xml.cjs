const {parseString} = require('xml2js');
const {promisify} = require('util');
const parseXml = promisify(parseString);

const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<exchange xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <viewpoints>
    <viewfolder name="COORD 05-21-26" guid="test-guid">
      <view name="C.123 6 SAN IN CONFLICT WITH DUCT" guid="view-guid">
        <viewpoint tool="navigator_walk"/>
      </view>
      <view name="C.124 FP MAIN TO SHIFT LEFT" guid="view-guid-2">
        <viewpoint tool="navigator_walk"/>
      </view>
    </viewfolder>
  </viewpoints>
</exchange>`;

parseXml(xml).then(r => {
  console.log('Top keys:', Object.keys(r));
  console.log('Exchange keys:', Object.keys(r.exchange));
  console.log('Viewpoints is array:', Array.isArray(r.exchange.viewpoints));
  console.log('Viewpoints[0] keys:', Object.keys(r.exchange.viewpoints[0]));
  console.log('Viewfolder[0].$:', JSON.stringify(r.exchange.viewpoints[0].viewfolder[0].$));
  console.log('View[0].$:', JSON.stringify(r.exchange.viewpoints[0].viewfolder[0].view[0].$));
}).catch(console.error);
