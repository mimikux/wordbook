/* Wordbook Cloud v3: presentation and editing based on Wordbook v2.1.9.
   Private data loads only after single-user Supabase auth; never bundled in HTML. */
(() => {
  'use strict';
  // The previous downloaded HTML stored private words at wordbook.local.v1.
  // The HTTPS app never reads that unrelated origin; migrate via the JSON export.
  const PAGE_SIZE=10;
  // Public reference only. Dates are conventional, cusp days can vary by year.
  const ZODIAC_DATES=Object.freeze({
    Capricorn:'12/22–1/19',Aquarius:'1/20–2/18',Pisces:'2/19–3/20',
    Aries:'3/21–4/19',Taurus:'4/20–5/20',Gemini:'5/21–6/20',
    Cancer:'6/21–7/22',Leo:'7/23–8/22',Virgo:'8/23–9/22',
    Libra:'9/23–10/22',Scorpio:'10/23–11/21',Sagittarius:'11/22–12/21'
  });
  const TAG_PAGE_SIZES=[6,8,10];
  function normalizeTagOrders(raw){
    const entries=raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.entries(raw):[];
    const result=Object.create(null);
    for(const [tag,config] of entries){
      if(!tag||['__proto__','constructor','prototype'].includes(tag)||!config||typeof config!=='object')continue;
      const ids=Array.isArray(config.order)?config.order.filter(id=>typeof id==='string'&&id.length<220):[];
      result[tag]={enabled:config.enabled===true,
        pageSize:TAG_PAGE_SIZES.includes(Number(config.pageSize))?Number(config.pageSize):PAGE_SIZE,
        showDates:config.showDates===true,order:[...new Set(ids)]};
    }
    return result;
  }
  // Personal-use taxonomy: five frequent parts of speech + one catch-all.
  // Old detailed POS names are kept in posDetails on each word, but displayed,
  // sorted and exported as these six categories. Unknown dictionary labels are
  // intentionally mapped to 'other' rather than silently discarded.
  const POS=[['noun','名詞'],['verb','動詞'],['adjective','形容詞'],['adverb','副詞'],['phrase','片語'],['other','其他']];
  const POS_ALIASES={
    'transitive verb':'verb','intransitive verb':'verb','phrasal verb':'verb',
    'n.':'noun','v.':'verb','adj.':'adjective','adv.':'adverb',
    '名詞':'noun','動詞':'verb','形容詞':'adjective','副詞':'adverb','片語':'phrase','其他':'other'
  };
  const PRIMARY_POS=new Set(POS.map(([key])=>key));
  function posItems(value){
    const raw=Array.isArray(value)?value.join(','):String(value||'');
    const labels=raw.split(/[,;，、|]+/).map(x=>x.trim().toLowerCase()).filter(Boolean);
    const categories=new Set(labels.map(x=>POS_ALIASES[x]||x).map(x=>PRIMARY_POS.has(x)?x:'other'));
    return POS.map(([key])=>key).filter(key=>categories.has(key));
  }
  const posString=value=>posItems(value).join(',');
  const isSingleWord=value=>/^[a-zA-Z][a-zA-Z'-]*$/.test(value.trim());
  // The editor keeps six selectable POS types (including phrase). In the
  // filtering screen they are intentionally organized into FIVE groups:
  // noun, verb, adjective, adverb and other (including phrase / unknown).
  // Multi-POS words can match several filters without duplication in the notebook.
  const POS_GROUPS=[['noun','名詞'],['verb','動詞'],['adjective','形容詞'],['adverb','副詞'],['other','其他']];
  function hasPosGroup(word,group){
    if(!group)return true;
    const types=posItems(word.pos);
    if(group==='other')return !types.length||types.includes('phrase')||types.includes('other');
    return types.includes(group);
  }
  const SORTS=[['new','加入時間 · 最新'],['old','加入時間 · 最早'],['az','英文字母 · A → Z'],['za','英文字母 · Z → A']];
  // Existing users may have selected the now-retired POS sorting option.
  // Migrate them to alphabetical order; keep their POS/tag filters intact.
  const normalizeSort=value=>value==='pos'?'az':(SORTS.some(([key])=>key===value)?value:'new');
  const CAT=window.WordbookCatalog||{version:'',sourceCount:0,words:[],notes:[]};
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=x=>String(x??'').replace(/\uFEFF/g,'').trim();
  // Taiwan Traditional display normalization: ICU-derived *conservative* character
  // table, plus context phrases. Avoid converting words already written in Traditional.
  // Original Google source fields remain unchanged for audit and comparison.
  const TRAD_CHAR_PAIRS="㑇㑳㑩儸㓥劏㔉劚㖊噚㖞喎㘎㘚㟆㠏㤘㥮㧐㩳㧑撝㧟擓㨫㩜㭎棡㱩殰㱮殨㲿瀇㶉鸂㶶燶㶽煱㺍獱䁖瞜䃅磾䅉稏䅟穇䇲筴䌶䊷䌷紬䌸縳䌹絅䌺䋙䌼綐䌽綵䌾䋻䍀繿䍁繸䏝膞䓕薳䓖藭䓨罃䗖螮䙓襬䜣訢䜧譅䜩讌䝙貙䞍䝼䞐賰䥽鏺䦃鐯䩄靦䯄騧䯅䯀䲝䱽䲟鮣䲠鰆䲢鰧䴓鳾䴔鵁䴕鴷䴖鶄䴗鶪䴘鷈䴙鷿䶮龑万萬与與丑醜专專业業丛叢东東丝絲丢丟两兩严嚴丧喪个個丰豐临臨为為丽麗举舉么麼义義乌烏乐樂乔喬习習乡鄉书書买買乱亂争爭于於亏虧云雲亘亙亚亞产產亩畝亲親亵褻亸嚲亿億仅僅仆僕从從仑侖仓倉仪儀们們价價众眾优優会會伛傴伞傘伟偉传傳伣俔伤傷伥倀伦倫伧傖伪偽伫佇体體佣傭佥僉侠俠侣侶侥僥侦偵侧側侨僑侩儈侪儕侬儂俣俁俦儔俨儼俩倆俪儷俫倈俭儉债債倾傾偬傯偻僂偾僨偿償傥儻傧儐储儲傩儺儿兒兑兌兖兗党黨兰蘭关關兴興兹茲养養兽獸冁囅内內冈岡册冊写寫军軍农農冯馮冲衝决決况況冻凍净淨凄淒凉涼减減凑湊凛凜凤鳳凫鳧凭憑凯凱击擊凿鑿刍芻刘劉则則刚剛创創删刪别別刬剗刭剄刹剎刽劊刿劌剀剴剂劑剐剮剑劍剥剝剧劇劝勸办辦务務劢勱动動励勵劲勁劳勞势勢勋勳勚勩匀勻匦匭匮匱区區医醫华華协協单單卖賣卢盧卤鹵卧臥卫衛却卻厂廠厅廳历歷厉厲压壓厌厭厍厙厐龎厕廁厘釐厢廂厣厴厦廈厨廚厩廄厮廝县縣叁叄参參叆靉叇靆双雙发發变變叙敘叠疊叶葉号號叹嘆叽嘰吓嚇吕呂吗嗎吣唚吨噸听聽启啓吴吳呐吶呒嘸呓囈呕嘔呖嚦呗唄员員呙咼呛嗆呜嗚咏詠咙嚨咛嚀咝噝咤吒响響哑啞哒噠哓嘵哔嗶哕噦哗嘩哙噲哜嚌哝噥哟喲唛嘜唝嗊唠嘮唡啢唢嗩唤喚啧嘖啬嗇啭囀啮嚙啰囉啴嘽啸嘯喂餵喷噴喽嘍喾嚳嗫囁嗳噯嘘噓嘤嚶嘱囑噜嚕嚣囂团團园園囱囪围圍囵圇国國图圖圆圓圣聖圹壙场場坂阪坏壞块塊坚堅坛壇坜壢坝壩坞塢坟墳坠墜垄壟垅壠垆壚垒壘垦墾垩堊垫墊垭埡垯墶垱壋垲塏垴堖埘塒埙塤埚堝埯垵堑塹堕墮塆壪墙牆壮壯声聲壳殼壶壺壸壼处處备備够夠头頭夸誇夹夾夺奪奁奩奂奐奋奮奖獎奥奧妆妝妇婦妈媽妩嫵妪嫗妫媯姗姍姹奼娄婁娅婭娆嬈娇嬌娈孌娱娛娲媧娴嫻婳嫿婴嬰婵嬋婶嬸媪媼媭嬃嫒嬡嫔嬪嫱嬙嬷嬤孙孫学學孪孿宁寧宝寶实實宠寵审審宪憲宫宮宽寬宾賓寝寢对對寻尋导導寿壽将將尔爾尘塵尝嘗尧堯尴尷尸屍尽盡层層屃屓屉屜届屆属屬屡屢屦屨屿嶼岁歲岂豈岖嶇岗崗岘峴岙嶴岚嵐岛島岭嶺岽崬岿巋峃嶨峄嶧峡峽峣嶢峤嶠峥崢峦巒崂嶗崃崍崄嶮崭嶄嵘嶸嵚嶔嵝嶁巅巔巩鞏巯巰币幣帅帥师師帏幃帐帳帘簾帜幟带帶帧幀帮幫帱幬帻幘帼幗幂冪并並广廣庄莊庆慶庐廬庑廡库庫应應庙廟庞龐废廢庼廎廪廩开開异異弃棄弑弒张張弥彌弪弳弯彎弹彈强強归歸当當录錄彟彠彦彥彷徬彻徹径徑徕徠忆憶忏懺忧憂忾愾怀懷态態怂慫怃憮怄慪怅悵怆愴怜憐总總怼懟怿懌恋戀恒恆恳懇恶惡恸慟恹懨恺愷恻惻恼惱恽惲悦悅悫愨悬懸悭慳悮悞悯憫惊驚惧懼惨慘惩懲惫憊惬愜惭慚惮憚惯慣愠慍愤憤愦憒愿願慑懾慭憖懑懣懒懶懔懍戆戇戋戔戏戲戗戧战戰戬戩戯戱户戶扑撲执執扩擴扪捫扫掃扬揚扰擾抚撫抛拋抟摶抠摳抡掄抢搶护護报報担擔拟擬拢攏拣揀拥擁拦攔拧擰拨撥择擇挂掛挚摯挛攣挜掗挝撾挞撻挟挾挠撓挡擋挢撟挣掙挤擠挥揮挦撏挽輓捝挩捞撈损損捡撿换換捣搗据據掳擄掴摑掷擲掸撣掺摻掼摜揽攬揾搵揿撳搀攙搁擱搂摟搅攪携攜摄攝摅攄摆擺摇搖摈擯摊攤撄攖撑撐撵攆撷擷撸擼撺攛擞擻攒攢敌敵敛斂敩斆数數斋齋斓斕斗鬥斩斬断斷无無旧舊时時旷曠旸暘昙曇昵暱昼晝昽曨显顯晋晉晒曬晓曉晔曄晕暈晖暉暂暫暧曖术術朴樸机機杀殺杂雜权權杆桿杠槓条條来來杨楊杩榪杰傑极極构構枞樅枢樞枣棗枥櫪枧梘枨棖枪槍枫楓枭梟柜櫃柠檸柽檉栀梔栅柵标標栈棧栉櫛栊櫳栋棟栌櫨栎櫟栏欄树樹栖棲样樣栾欒桠椏桡橈桢楨档檔桤榿桥橋桦樺桧檜桨槳桩樁梦夢梼檮梾棶梿槤检檢棁梲棂櫺棱稜椁槨椟櫝椠槧椤欏椭橢楼樓榄欖榅榲榇櫬榈櫚榉櫸槚檟槛檻槟檳槠櫧横橫樯檣樱櫻橥櫫橱櫥橹櫓橼櫞檩檁欢歡欤歟欧歐歼殲殁歿殇殤残殘殒殞殓殮殚殫殡殯殴毆毁毀毂轂毕畢毙斃毡氈毵毿氇氌气氣氢氫氩氬氲氳汇匯汉漢汤湯汹洶沟溝没沒沣灃沤漚沥瀝沦淪沧滄沨渢沩溈沪滬泄洩泞濘泪淚泶澩泷瀧泸瀘泺濼泻瀉泼潑泽澤泾涇洁潔洒灑洼窪浃浹浅淺浆漿浇澆浈湞浉溮浊濁测測浍澮济濟浏瀏浐滻浑渾浒滸浓濃浔潯浕濜涂塗涌湧涛濤涝澇涞淶涟漣涠潿涡渦涢溳涣渙涤滌润潤涧澗涨漲涩澀淀澱渊淵渌淥渍漬渎瀆渐漸渑澠渔漁渖瀋渗滲温溫湾灣湿濕溁濚溃潰溅濺溆漵溇漊滗潷滚滾滞滯滟灧滠灄满滿滢瀅滤濾滥濫滦灤滨濱滩灘滪澦漓灕漤灠潆瀠潇瀟潋瀲潍濰潜潛潴瀦澛瀂澜瀾濑瀨濒瀕灏灝灭滅灯燈灵靈灾災灿燦炀煬炉爐炖燉炜煒炝熗点點炼煉炽熾烁爍烂爛烃烴烛燭烟煙烦煩烧燒烨燁烩燴烫燙烬燼热熱焕煥焖燜焘燾煴熅爱愛爷爺牍牘牦氂牵牽牺犧犊犢状狀犷獷犸獁犹猶狈狽狝獮狞獰独獨狭狹狮獅狯獪狰猙狱獄狲猻猃獫猎獵猕獼猡玀猪豬猫貓猬蝟献獻獭獺玑璣玙璵玚瑒玛瑪玮瑋环環现現玱瑲玺璽珐琺珑瓏珰璫珲琿琎璡琏璉琐瑣琼瓊瑶瑤瑷璦璎瓔瓒瓚瓮甕瓯甌电電画畫畅暢畴疇疖癤疗療疟瘧疠癘疡瘍疬癧疭瘲疮瘡疯瘋疱皰疴痾痈癰痉痙痒癢痖瘂痨癆痪瘓痫癇瘅癉瘆瘮瘗瘞瘘瘻瘪癟瘫癱瘾癮瘿癭癞癩癣癬癫癲皑皚皱皺皲皸盏盞盐鹽监監盖蓋盗盜盘盤眍瞘眦眥眬矓着著睁睜睐睞睑瞼睾睪瞆瞶瞒瞞瞩矚矫矯矶磯矾礬矿礦砀碭码碼砖磚砗硨砚硯砜碸砺礪砻礱砾礫础礎硁硜硕碩硖硤硗磽硙磑硚礄确確硷礆碍礙碛磧碜磣碱鹼礴礡礼禮祃禡祎禕祢禰祯禎祷禱祸禍禀稟禄祿禅禪离離秃禿秆稈种種积積称稱秽穢秾穠稆穭税稅稣穌稳穩穑穡穷窮窃竊窍竅窎窵窑窯窜竄窝窩窥窺窦竇窭窶竖竪竞競笃篤笋筍笔筆笕筧笺箋笼籠笾籩筑築筚篳筛篩筜簹筝箏筹籌筼篔签簽简簡箓籙箦簀箧篋箨籜箩籮箪簞箫簫篑簣篓簍篮籃篯籛篱籬簖籪籁籟籴糴类類籼秈粜糶粝糲粤粵粪糞粮糧糁糝糇餱紧緊絷縶纟糹纠糾纡紆红紅纣紂纤纖纥紇约約级級纨紈纩纊纪紀纫紉纬緯纭紜纮紘纯純纰紕纱紗纲綱纳納纴紝纵縱纶綸纷紛纸紙纹紋纺紡纻紵纼紖纽紐纾紓线線绀紺绁紲绂紱练練组組绅紳细細织織终終绉縐绊絆绋紼绌絀绍紹绎繹经經绐紿绑綁绒絨结結绔絝绕繞绖絰绗絎绘繪给給绚絢绛絳络絡绝絕绞絞统統绠綆绡綃绢絹绣繡绤綌绥綏绦縧继繼绨綈绩績绪緒绫綾绬緓续續绮綺绯緋绰綽绱緔绲緄绳繩维維绵綿绶綬绷繃绸綢绹綯绺綹绻綣综綜绽綻绾綰绿綠缀綴缁緇缂緙缃緗缄緘缅緬缆纜缇緹缈緲缉緝缊縕缋繢缌緦缍綞缎緞缏緶缐線缑緱缒縋缓緩缔締缕縷编編缗緡缘緣缙縉缚縛缛縟缜縝缝縫缞縗缟縞缠纏缡縭缢縊缣縑缤繽缥縹缦縵缧縲缨纓缩縮缪繆缫繅缬纈缭繚缮繕缯繒缰繮缱繾缲繰缳繯缴繳缵纘罂罌网網罗羅罚罰罢罷罴羆羁羈羟羥羡羨翘翹翙翽翚翬耢耮耧耬耸聳耻恥聂聶聋聾职職聍聹联聯聩聵聪聰肃肅肠腸肤膚肮骯肾腎肿腫胀脹胁脅胆膽胜勝胧朧胨腖胪臚胫脛胶膠脉脈脍膾脏髒脐臍脑腦脓膿脔臠脚腳脱脫脶腡脸臉腊臘腌醃腘膕腭齶腻膩腽膃腾騰膑臏膻羶臜臢舆輿舣艤舰艦舱艙舻艫艰艱艳艷艺藝节節芈羋芗薌芜蕪芦蘆苁蓯苇葦苈藶苋莧苌萇苍蒼苎苧苏蘇苧薴苹蘋范範茎莖茏蘢茑蔦茔塋茕煢茧繭荆荊荐薦荙薘荚莢荛蕘荜蓽荞蕎荟薈荠薺荡蕩荣榮荤葷荥滎荦犖荧熒荨蕁荩藎荪蓀荫蔭荬蕒荭葒荮葤药藥莅蒞莱萊莲蓮莳蒔莴萵莶薟获獲莸蕕莹瑩莺鶯莼蒓萚蘀萝蘿萤螢营營萦縈萧蕭萨薩葱蔥蒇蕆蒉蕢蒋蔣蒌蔞蓝藍蓟薊蓠蘺蓣蕷蓥鎣蓦驀蔂虆蔷薔蔹蘞蔺藺蔼藹蕰薀蕲蘄蕴蘊薮藪藓蘚蘖櫱虏虜虑慮虚虛虫蟲虬虯虮蟣虱蝨虽雖虾蝦虿蠆蚀蝕蚁蟻蚂螞蚕蠶蚝蠔蚬蜆蛊蠱蛎蠣蛏蟶蛮蠻蛰蟄蛱蛺蛲蟯蛳螄蛴蠐蜕蛻蜗蝸蜡蠟蝇蠅蝈蟈蝉蟬蝎蠍蝼螻蝾蠑螀螿螨蟎蟏蠨衅釁衔銜补補衬襯衮袞袄襖袅裊袆褘袜襪袭襲袯襏装裝裆襠裈褌裢褳裣襝裤褲裥襇褛褸褴襤襕襴见見观觀觃覎规規觅覓视視觇覘览覽觉覺觊覬觋覡觌覿觍覥觎覦觏覯觐覲觑覷觞觴触觸觯觶訚誾詟讋誉譽誊謄讠訁计計订訂讣訃认認讥譏讦訐讧訌讨討让讓讪訕讫訖讬託训訓议議讯訊记記讱訒讲講讳諱讴謳讵詎讶訝讷訥许許讹訛论論讻訩讼訟讽諷设設访訪诀訣证證诂詁诃訶评評诅詛识識诇詗诈詐诉訴诊診诋詆诌謅词詞诎詘诏詔诐詖译譯诒詒诓誆诔誄试試诖詿诗詩诘詰诙詼诚誠诛誅诜詵话話诞誕诟詬诠詮诡詭询詢诣詣诤諍该該详詳诧詫诨諢诩詡诪譸诫誡诬誣语語诮誚误誤诰誥诱誘诲誨诳誑说說诵誦诶誒请請诸諸诹諏诺諾读讀诼諑诽誹课課诿諉谀諛谁誰谂諗调調谄諂谅諒谆諄谇誶谈談谊誼谋謀谌諶谍諜谎謊谏諫谐諧谑謔谒謁谓謂谔諤谕諭谖諼谗讒谘諮谙諳谚諺谛諦谜謎谝諞谞諝谟謨谠讜谡謖谢謝谣謠谤謗谥謚谦謙谧謐谨謹谩謾谪謫谫謭谬謬谭譚谮譖谯譙谰讕谱譜谲譎谳讞谴譴谵譫谶讖豮豶贝貝贞貞负負贠貟贡貢财財责責贤賢败敗账賬货貨质質贩販贪貪贫貧贬貶购購贮貯贯貫贰貳贱賤贲賁贳貰贴貼贵貴贶貺贷貸贸貿费費贺賀贻貽贼賊贽贄贾賈贿賄赀貲赁賃赂賂赃贓资資赅賅赆贐赇賕赈賑赉賚赊賒赋賦赌賭赍賫赎贖赏賞赐賜赑贔赒賙赓賡赔賠赕賧赖賴赗賵赘贅赙賻赚賺赛賽赜賾赝贋赞贊赟贇赠贈赡贍赢贏赣贛赪赬赵趙赶趕趋趨趱趲趸躉跃躍跄蹌跞躒践踐跶躂跷蹺跸蹕跹躚跻躋踊踴踌躊踪蹤踬躓踯躑蹑躡蹒蹣蹰躕蹿躥躏躪躜躦躯軀车車轧軋轨軌轩軒轪軑轫軔转轉轭軛轮輪软軟轰轟轱軲轲軻轳轤轴軸轵軹轶軼轷軤轸軫轹轢轺軺轻輕轼軾载載轾輊轿轎辀輈辁輇辂輅较較辄輒辅輔辆輛辇輦辈輩辉輝辊輥辋輞辌輬辍輟辎輜辏輳辐輻辑輯辒轀输輸辔轡辕轅辖轄辗輾辘轆辙轍辚轔辞辭辩辯辫辮边邊辽遼达達迁遷过過迈邁运運还還这這进進远遠违違连連迟遲迩邇迳逕迹跡适適选選逊遜递遞逦邐逻邏遗遺遥遙邓鄧邝鄺邬鄔邮郵邹鄒邺鄴邻鄰郏郟郐鄶郑鄭郓鄆郦酈郧鄖郸鄲酂酇酝醖酦醱酱醬酽釅酾釃酿釀采採释釋鉴鑒銮鑾錾鏨钅釒钆釓钇釔针針钉釘钊釗钋釙钌釕钍釷钎釺钏釧钐釤钑鈒钒釩钓釣钔鍆钕釹钖鍚钗釵钘鈃钙鈣钚鈈钛鈦钜鉅钝鈍钞鈔钠鈉钡鋇钢鋼钣鈑钤鈐钥鑰钦欽钧鈞钨鎢钩鈎钪鈧钫鈁钬鈥钭鈄钮鈕钯鈀钰鈺钱錢钲鉦钳鉗钴鈷钵鉢钶鈳钷鉕钸鈽钹鈸钺鉞钻鑽钼鉬钽鉭钾鉀钿鈿铀鈾铁鐵铂鉑铃鈴铄鑠铅鉛铆鉚铇鉋铈鈰铉鉉铊鉈铋鉍铌鈮铍鈹铎鐸铏鉶铐銬铑銠铒鉺铓鋩铔錏铕銪铖鋮铗鋏铘鋣铙鐃铚銍铛鐺铜銅铝鋁铞銱铟銦铠鎧铡鍘铢銖铣銑铤鋌铥銩铦銛铧鏵铨銓铩鎩铪鉿铫銚铬鉻铭銘铮錚铯銫铰鉸铱銥铲鏟铳銃铴鐋铵銨银銀铷銣铸鑄铹鐒铺鋪铻鋙铼錸铽鋱链鏈铿鏗销銷锁鎖锂鋰锃鋥锄鋤锅鍋锆鋯锇鋨锈鏽锉銼锊鋝锋鋒锌鋅锍鋶锎鐦锏鐧锐銳锑銻锒鋃锓鋟锔鋦锕錒锖錆锗鍺锘鍩错錯锚錨锛錛锜錡锝鍀锞錁锟錕锠錩锡錫锢錮锣鑼锤錘锥錐锦錦锧鑕锨鍁锩錈锪鍃锫錇锬錟锭錠键鍵锯鋸锰錳锱錙锲鍥锳鍈锴鍇锵鏘锶鍶锷鍔锸鍤锹鍬锺鍾锻鍛锼鎪锽鍠锾鍰锿鎄镀鍍镁鎂镂鏤镃鎡镄鐨镅鎇镆鏌镇鎮镈鎛镉鎘镊鑷镋鎲镌鐫镍鎳镎鎿镏鎦镐鎬镑鎊镒鎰镓鎵镔鑌镕鎔镖鏢镗鏜镘鏝镙鏍镚鏰镛鏞镜鏡镝鏑镞鏃镟鏇镠鏐镡鐔镢鐝镣鐐镤鏷镥鑥镦鐓镧鑭镨鐠镩鑹镪鏹镫鐙镬鑊镭鐳镮鐶镯鐲镰鐮镱鐿镲鑔镳鑣镴鑞镵鑱镶鑲长長门門闩閂闪閃闫閆闬閈闭閉问問闯闖闰閏闱闈闲閒闳閎间間闵閔闶閌闷悶闸閘闹鬧闺閨闻聞闼闥闽閩闾閭闿闓阀閥阁閣阂閡阃閫阄鬮阅閱阆閬阇闍阈閾阉閹阊閶阋鬩阌閿阍閽阎閻阏閼阐闡阑闌阒闃阓闠阔闊阕闋阖闔阗闐阘闒阙闕阚闞阛闤队隊阳陽阴陰阵陣阶階际際陆陸陇隴陈陳陉陘陕陝陧隉陨隕险險随隨隐隱隶隸隽雋难難雏雛雠讎雳靂雾霧霁霽霡霢霭靄靓靚静靜靥靨鞑韃鞒鞽鞯韉韦韋韧韌韨韍韩韓韪韙韫韞韬韜韵韻页頁顶頂顷頃顸頇项項顺順须須顼頊顽頑顾顧顿頓颀頎颁頒颂頌颃頏预預颅顱领領颇頗颈頸颉頡颊頰颋頲颌頜颍潁颎熲颏頦颐頤频頻颒頮颓頹颔頷颕頴颖穎颗顆题題颙顒颚顎颛顓颜顏额額颞顳颟顢颠顛颡顙颢顥颤顫颥顬颦顰颧顴风風飏颺飐颭飑颮飒颯飓颶飔颸飕颼飖颻飗飀飘飄飙飆飚飈飞飛飨饗餍饜饣飠饤飣饥飢饦飥饧餳饨飩饩餼饪飪饫飫饬飭饭飯饮飲饯餞饰飾饱飽饲飼饳飿饴飴饵餌饶饒饷餉饸餄饹餎饺餃饻餏饼餅饽餑饾餖饿餓馀餘馁餒馂餕馃餜馄餛馅餡馆館馇餷馈饋馉餶馊餿馋饞馌饁馍饃馎餺馏餾馐饈馑饉馒饅馓饊馔饌馕饢马馬驭馭驮馱驯馴驰馳驱驅驲馹驳駁驴驢驵駔驶駛驷駟驸駙驹駒驺騶驻駐驼駝驽駑驾駕驿驛骀駘骁驍骂罵骃駰骄驕骅驊骆駱骇駭骈駢骉驫骊驪骋騁验驗骍騂骎駸骏駿骐騏骑騎骒騍骓騅骔騌骕驌骖驂骗騙骘騭骙騤骚騷骛騖骜驁骝騮骞騫骟騸骠驃骡騾骢驄骣驏骤驟骥驥骦驦骧驤髅髏髋髖髌髕鬓鬢鬶鬹魇魘魉魎鱼魚鱽魛鱾魢鱿魷鲀魨鲁魯鲂魴鲃䰾鲄魺鲅鮁鲆鮃鲇鮎鲈鱸鲉鮋鲊鮓鲋鮒鲌鮊鲍鮑鲎鱟鲏鮍鲐鮐鲑鮭鲒鮚鲓鮳鲔鮪鲕鮞鲖鮦鲗鰂鲘鮜鲙鱠鲚鱭鲛鮫鲜鮮鲝鮺鲞鮝鲟鱘鲠鯁鲡鱺鲢鰱鲣鰹鲤鯉鲥鰣鲦鰷鲧鯀鲨鯊鲩鯇鲪鮶鲫鯽鲬鯒鲭鯖鲮鯪鲯鯕鲰鯫鲱鯡鲲鯤鲳鯧鲴鯝鲵鯢鲶鯰鲷鯛鲸鯨鲹鰺鲺鯴鲻鯔鲼鱝鲽鰈鲾鰏鲿鱨鳀鯷鳁鰮鳂鰃鳃鰓鳄鰐鳅鰍鳆鰒鳇鰉鳈鰁鳉鱂鳊鯿鳋鰠鳌鰲鳍鰭鳎鰨鳏鰥鳐鰩鳑鰟鳒鰜鳓鰳鳔鰾鳕鱈鳖鱉鳗鰻鳘鰵鳙鱅鳚䲁鳛鰼鳜鱖鳝鱔鳞鱗鳟鱒鳠鱯鳡鱤鳢鱧鳣鱣鳤䲘鸟鳥鸠鳩鸡雞鸢鳶鸣鳴鸤鳲鸥鷗鸦鴉鸧鶬鸨鴇鸩鴆鸪鴣鸫鶇鸬鸕鸭鴨鸮鴞鸯鴦鸰鴒鸱鴟鸲鴝鸳鴛鸴鷽鸵鴕鸶鷥鸷鷙鸸鴯鸹鴰鸺鵂鸻鴴鸼鵃鸽鴿鸾鸞鸿鴻鹀鵐鹁鵓鹂鸝鹃鵑鹄鵠鹅鵝鹆鵒鹇鷳鹈鵜鹉鵡鹊鵲鹋鶓鹌鵪鹍鵾鹎鵯鹏鵬鹐鵮鹑鶉鹒鶊鹓鵷鹔鷫鹕鶘鹖鶡鹗鶚鹘鶻鹙鶖鹚鷀鹛鶥鹜鶩鹝鷊鹞鷂鹟鶲鹠鶹鹡鶺鹢鷁鹣鶼鹤鶴鹥鷖鹦鸚鹧鷓鹨鷚鹩鷯鹪鷦鹫鷲鹬鷸鹭鷺鹮䴉鹯鸇鹰鷹鹱鸌鹲鸏鹳鸛鹴鸘鹾鹺麦麥麸麩麹麴黄黃黉黌黡黶黩黷黪黲黾黽鼋黿鼍鼉鼗鞀鼹鼴齐齊齑齏齿齒龀齔龁齕龂齗龃齟龄齡龅齙龆齠龇齜龈齦龉齬龊齪龋齲龌齷龙龍龚龔龛龕龟龜鿎䃮鿏䥑鿔鎶鿭鉨";
  const TRAD_CHAR_MAP=(()=>{const m=Object.create(null);for(let i=0;i<TRAD_CHAR_PAIRS.length;i+=2)m[TRAD_CHAR_PAIRS[i]]=TRAD_CHAR_PAIRS[i+1];return m;})();
  // No personal vocabulary-specific correction list is ever published.
  const TW_SOURCE_FIXES=new Map();
  function toTraditionalZh(text,english=''){
    const old=clean(text);if(!old)return old;
    const known=TW_SOURCE_FIXES.get(String(english).trim().toLocaleLowerCase('en-US'));
    if(known&&old===known[0])return known[1];
    // Protect common Taiwanese Traditional forms such as 里程、沉著、拜占庭.
    let value=old;
    const contexts=[['头发','頭髮'],['理发','理髮'],['发型','髮型'],['头型','頭型'],['皇后','皇后'],['以后','以後'],['后来','後來']];
    const guards=[];
    for(const [from,to] of contexts){
      if(value.includes(from)){const token=String.fromCharCode(0xE000+guards.length);guards.push(to);value=value.split(from).join(token);}
    }
    value=Array.from(value,ch=>TRAD_CHAR_MAP[ch]||ch).join('');
    for(let i=0;i<guards.length;i++)value=value.split(String.fromCharCode(0xE000+i)).join(guards[i]);
    return value;
  }
  const norm=x=>clean(x).replace(/\s+/g,' ').toLocaleLowerCase('en-US');
  const uuid=()=>(globalThis.crypto?.randomUUID?.()||`wb-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const safeDate=x=>Number.isFinite(Date.parse(x))?Date.parse(x):0;
  const hasHan=x=>/[\u3400-\u9fff]/.test(String(x??''));
  const timeNow=()=>new Date().toISOString();
  const escapeHeader=x=>String(x??'').replace(/[\r\n]+/g,' ').slice(0,160);

  function blankState(){return {version:2,words:[],tags:['日常','閱讀','工作','考試'],tagOrders:{},settings:{sort:'new',tag:'',pos:'',search:''},appliedDatasets:[],deletedKeys:[],translatorUrl:''};}
  function fixWord(w){
    return {id:String(w.id||uuid()),en:clean(w.en),zh:toTraditionalZh(w.zh,w.en),note:String(w.note??w.notes??''),
      pos:posString(w.pos),posDetails:String(w.posDetails??w.posOriginal??w.pos??''),
      posSource:String(w.posSource|| (w.pos?'legacy':'') ),tags:Array.isArray(w.tags)?w.tags.map(String):[],source:String(w.source||''),
      originals:Array.isArray(w.originals)?w.originals:[],createdAt:w.createdAt||timeNow(),updatedAt:w.updatedAt||w.createdAt||timeNow()};
  }
  function loadRaw(){return blankState();} // Cloud version: never auto-import legacy browser data.
  function applyCatalog(st){
    if(st.appliedDatasets.includes(CAT.version))return;
    const map=new Map(st.words.map(w=>[norm(w.en),w]));
    const removed=new Set(st.deletedKeys);
    const baseline=Date.now()-1200000;
    for(const rec of CAT.words||[]){
      const key=norm(rec.en);
      if(!key||removed.has(key))continue;
      let existing=map.get(key);
      if(!existing){
        existing=fixWord({...rec,id:uuid(),createdAt:new Date(baseline-Number(rec.seedOrder||0)*1000).toISOString(),updatedAt:new Date(baseline-Number(rec.seedOrder||0)*1000).toISOString()});
        st.words.push(existing);map.set(key,existing);
      } else if(Array.isArray(rec.originals)&&rec.originals.length){
        const rows=new Set(existing.originals.map(r=>`${r.from}|${r.to}|${r.originalSource}|${r.originalTarget}`));
        for(const origin of rec.originals){
          const k=`${origin.from}|${origin.to}|${origin.originalSource}|${origin.originalTarget}`;
          if(!rows.has(k)){existing.originals.push(origin);rows.add(k);}
        }
      }
      // For old saved v2.1.x data, apply only character/script normalization.
      // Never replace a custom explanation, POS, tag or translated meaning.
      const adjusted=toTraditionalZh(existing.zh,existing.en);
      if(adjusted!==existing.zh)existing.zh=adjusted;
      // Upgrade v2.0 on the same origin without changing translations, notes or edited POS.
      if(!existing.pos && rec.pos){existing.pos=posString(rec.pos);existing.posSource=rec.posSource||'preliminary';}
    }
    for(const entry of CAT.notes||[]){
      const key=norm(entry.en);
      if(removed.has(key))continue;
      const word=map.get(key);
      if(!word)continue;
      // Never overwrite a user's previously edited explanation or translation.
      if(!clean(word.note))word.note=String(entry.note||'');
      if(!word.pos&&entry.pos){word.pos=posString(entry.pos);word.posSource='curated';}
    }
    st.appliedDatasets.push(CAT.version);
  }
  let state=blankState(); // DO NOT preload any personal dictionary into public HTML.
  // Only the page number (not private vocabulary) is stored for this tab.
  // Restore it after the first authenticated cloud load, never during the
  // empty pre-login render. Reset this position on explicit sign-out.
  const PAGE_POSITION_KEY='wordbook-current-page-v3';
  const readStoredPage=()=>{
    try{const value=Number(sessionStorage.getItem(PAGE_POSITION_KEY));return Number.isSafeInteger(value)&&value>=0?value:0;}
    catch(e){return 0;}
  };
  const rememberPage=()=>{try{sessionStorage.setItem(PAGE_POSITION_KEY,String(currentPage));}catch(e){}};
  const forgetPage=()=>{try{sessionStorage.removeItem(PAGE_POSITION_KEY);}catch(e){}};
  let restorePageOnLogin=true;
  let currentPage=0,touchStart=null,toastTimer=0,savedOk=true,activeSheet='';
  let searchOriginPage=null,highlightedWordId='';
  // v2.1.9: Android downloaded HTML often has an opaque content:// origin.
  // Prefer direct WebAudio buffer output over MP3 data: URLs via HTMLAudioElement.
  // On a real user click, resume AudioContext synchronously; decode/play offline
  // embedded MP3 samples and use Blob-backed HTMLAudio or device TTS as fallbacks.
  // None of this reads or alters the vocabulary database.
  const pageSpeech={active:false,token:0,words:[],index:0,signature:'',ctx:null,source:null,
    audio:null,objectURL:'',utter:null,watchdog:0,started:false,engine:'',unlockPending:null};
  const voiceClips=window.WordbookAudioPack?.clips||{};
  const clipAliases=new Map(Object.entries(voiceClips).map(([term,b64])=>[norm(term).replace(/[.!?。]+$/,'').trim(),b64]));
  const offlineClipFor=en=>voiceClips[norm(en)]||clipAliases.get(norm(en).replace(/[.!?。]+$/,'').trim());
  const decodedClipCache=new Map();
  const audioDiagnosis={stage:'尚未播放',engine:'未選擇',word:'',error:'',progress:'',lastUpdate:''};
  const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
  const speechAvailable=()=>!!window.speechSynthesis&&typeof window.SpeechSynthesisUtterance==='function';
  const pageSignature=words=>words.map(w=>`${w.id}\u0000${w.en}`).join('\u0001');
  const audioMode=()=>state.settings.audioMode==='media'?'media':'webaudio';
  function markAudio(stage,details='',error=''){
    audioDiagnosis.stage=stage;
    audioDiagnosis.word=pageSpeech.words[pageSpeech.index]?.en||audioDiagnosis.word;
    audioDiagnosis.engine=pageSpeech.engine||audioMode();
    audioDiagnosis.progress=details;
    if(error)audioDiagnosis.error=error;
    audioDiagnosis.lastUpdate=new Date().toLocaleTimeString('zh-TW',{hour12:false});
    const stateEl=$('#audio-debug-state');if(stateEl)stateEl.textContent=audioDiagnosis.stage+'｜'+(audioDiagnosis.progress||'');
    const errorEl=$('#audio-debug-error');if(errorEl)errorEl.textContent=audioDiagnosis.error||'目前沒有記錄到錯誤';
  }
  function updateSpeechButton(){
    const btn=$('#read-page-btn');if(!btn)return;
    btn.classList.toggle('is-speaking',pageSpeech.active);
    btn.setAttribute('aria-pressed',String(pageSpeech.active));
    btn.setAttribute('aria-label',pageSpeech.active?'停止朗讀本頁單字':'朗讀本頁英文單字（美式發音）');
    btn.title=pageSpeech.active?'停止朗讀':'朗讀本頁英文（美式發音）';
    $('#read-page-label').textContent=pageSpeech.active?(pageSpeech.started?'停止':'準備中'):'朗讀';
  }
  function highlightSpeakingWord(){
    const current=pageSpeech.active?pageSpeech.words[pageSpeech.index]?.id:null;
    $$('[data-word-id]',$('#word-list')).forEach(row=>row.classList.toggle('speaking',!!current&&row.dataset.wordId===current));
  }
  function releaseAudioMedia(){
    if(pageSpeech.audio){
      const audio=pageSpeech.audio;
      audio.onended=null;audio.onerror=null;audio.onplaying=null;
      try{audio.pause();audio.removeAttribute('src');audio.load();}catch(e){}
      pageSpeech.audio=null;
    }
    if(pageSpeech.objectURL){try{URL.revokeObjectURL(pageSpeech.objectURL);}catch(e){}pageSpeech.objectURL='';}
  }
  function stopPageSpeech(completed=false){
    pageSpeech.token++;
    const wasActive=pageSpeech.active;
    pageSpeech.active=false;pageSpeech.words=[];pageSpeech.signature='';pageSpeech.index=0;
    pageSpeech.started=false;clearTimeout(pageSpeech.watchdog);pageSpeech.watchdog=0;
    if(pageSpeech.source){const src=pageSpeech.source;src.onended=null;try{src.stop(0);}catch(e){}try{src.disconnect();}catch(e){}pageSpeech.source=null;}
    releaseAudioMedia();pageSpeech.utter=null;
    if(speechAvailable()){try{window.speechSynthesis.cancel();}catch(e){}}
    highlightSpeakingWord();updateSpeechButton();
    if(wasActive)markAudio(completed?'本頁朗讀完成':'已停止',audioDiagnosis.progress);
  }
  function reportAudioError(message,detail=''){
    stopPageSpeech();markAudio('播放失敗',detail,message);toast(message+'（詳情：更多 → 語音診斷）',8600);
    console.warn('Wordbook audio:',message,detail);
  }
  function chooseAmericanVoice(){
    try{
      const all=window.speechSynthesis.getVoices()||[],us=all.filter(v=>/^en[-_]US$/i.test(v.lang||''));
      return us.find(v=>/google.*us english|english.*united states|english.*us/i.test(v.name||''))||
        us.find(v=>v.localService)||us.find(v=>v.default)||us[0]||null;
    }catch(e){return null;}
  }
  function nextPageSpeechWord(token,index){
    if(!pageSpeech.active||token!==pageSpeech.token||pageSpeech.index!==index)return;
    clearTimeout(pageSpeech.watchdog);
    pageSpeech.index++;
    if(pageSpeech.index>=pageSpeech.words.length){stopPageSpeech(true);return;}
    pageSpeech.started=false;highlightSpeakingWord();updateSpeechButton();speakNextWord(token);
  }
  function speakNativeWord(token,index,reason=''){
    if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
    if(!speechAvailable()){reportAudioError('單字沒有內建音檔，且手機未提供語音服務。',reason);return;}
    pageSpeech.engine='系統 TTS';
    const word=pageSpeech.words[index];let utter;
    try{utter=new SpeechSynthesisUtterance(word.en);}catch(e){reportAudioError('無法啟動系統朗讀',String(e));return;}
    pageSpeech.utter=utter;utter.lang='en-US';utter.rate=0.9;utter.pitch=1;
    const voice=chooseAmericanVoice();if(voice)utter.voice=voice;
    let started=false;
    utter.onstart=()=>{
      if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
      started=true;pageSpeech.started=true;clearTimeout(pageSpeech.watchdog);
      markAudio('系統語音正在播放',word.en);updateSpeechButton();
    };
    utter.onend=()=>nextPageSpeechWord(token,index);
    utter.onerror=e=>{
      if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
      reportAudioError('系統語音失敗（'+(e?.error||'未知')+'）',reason);
    };
    markAudio('等待系統語音',reason);
    pageSpeech.watchdog=setTimeout(()=>{
      if(pageSpeech.active&&token===pageSpeech.token&&index===pageSpeech.index&&!started){
        reportAudioError('Android 文字轉語音沒有啟動',word.en);
      }
    },5500);
    try{window.speechSynthesis.speak(utter);}catch(e){reportAudioError('系統朗讀發生錯誤',String(e));}
  }
  function bytesFromBase64(b64){
    const binary=atob(b64),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return bytes;
  }
  function unlockWebAudio(){
    if(!AudioContextCtor)return null;
    if(!pageSpeech.ctx||pageSpeech.ctx.state==='closed'){
      pageSpeech.ctx=new AudioContextCtor({latencyHint:'interactive'});
    }
    if(pageSpeech.ctx.state!=='running'){
      // Must be called during the actual user's button click.
      pageSpeech.unlockPending=pageSpeech.ctx.resume().catch(e=>{
        markAudio('解鎖失敗',String(e),String(e));throw e;
      });
      // Prevent a rejected unlock from becoming an unhandled promise while
      // asynchronous decoding is being prepared.
      pageSpeech.unlockPending.catch(()=>{});
    }else pageSpeech.unlockPending=Promise.resolve();
    return pageSpeech.ctx;
  }
  function withAudioDeadline(task,ms,label){
    let timer;return Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+" 超時")),ms);})]).finally(()=>clearTimeout(timer));
  }
  async function playOfflineWebAudio(token,index,b64){
    const word=pageSpeech.words[index];
    const ctx=pageSpeech.ctx;
    if(!ctx)return playOfflineMedia(token,index,b64,'此環境不支援 Web Audio');
    pageSpeech.engine='Web Audio';markAudio('音檔解碼中',word.en);
    try{
      let buffer=decodedClipCache.get(word.en);
      if(!buffer){
        const bytes=bytesFromBase64(b64);
        buffer=await withAudioDeadline(ctx.decodeAudioData(bytes.buffer.slice(0)),5000,"音檔解碼");
        if(decodedClipCache.size>=25)decodedClipCache.delete(decodedClipCache.keys().next().value);
        decodedClipCache.set(word.en,buffer);
      }
      if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
      if(pageSpeech.unlockPending)await withAudioDeadline(pageSpeech.unlockPending,4000,"音訊啟動");
      if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
      if(ctx.state!=='running'){
        // Do not label a suspended audio context as successfully playing.
        return playOfflineMedia(token,index,b64,'AudioContext '+ctx.state);
      }
      const source=ctx.createBufferSource(),gain=ctx.createGain();
      source.buffer=buffer;gain.gain.value=1.0;
      source.connect(gain);gain.connect(ctx.destination);
      pageSpeech.source=source;pageSpeech.started=true;
      const startClock=ctx.currentTime;
      source.onended=()=>nextPageSpeechWord(token,index);
      source.start(0);
      markAudio('Web Audio 正在播放',word.en+'｜'+buffer.duration.toFixed(2)+'秒｜'+ctx.state);
      updateSpeechButton();
      pageSpeech.watchdog=setTimeout(()=>{
        if(pageSpeech.active&&token===pageSpeech.token&&index===pageSpeech.index){
          if(ctx.state!=='running'||ctx.currentTime-startClock<0.15){
            source.onended=null;try{source.stop();}catch(e){}pageSpeech.source=null;
            playOfflineMedia(token,index,b64,'Web Audio 未運作：'+ctx.state);
          }
        }
      },900);
    }catch(e){
      if(pageSpeech.active&&token===pageSpeech.token&&index===pageSpeech.index){
        playOfflineMedia(token,index,b64,'Web Audio 解碼／解鎖：'+(e?.message||String(e)));
      }
    }
  }
  function playOfflineMedia(token,index,b64,why=''){
    if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
    pageSpeech.engine='HTML 音訊（Blob）';
    const word=pageSpeech.words[index];releaseAudioMedia();
    let audio;
    try{
      audio=new Audio();pageSpeech.audio=audio;
      pageSpeech.objectURL=URL.createObjectURL(new Blob([bytesFromBase64(b64)],{type:'audio/mpeg'}));
      audio.preload='auto';audio.src=pageSpeech.objectURL;audio.volume=1;
    }catch(e){reportAudioError('瀏覽器無法載入內建音檔',String(e));return;}
    markAudio('HTML 音訊準備中',word.en+(why?'｜'+why:''));
    const startTime=Date.now();
    audio.onplaying=()=>{
      if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
      pageSpeech.started=true;markAudio('HTML 音訊正在播放',word.en);updateSpeechButton();
    };
    audio.onended=()=>{
      if(token!==pageSpeech.token)return;
      releaseAudioMedia();nextPageSpeechWord(token,index);
    };
    audio.onerror=()=>{
      if(!pageSpeech.active||token!==pageSpeech.token||index!==pageSpeech.index)return;
      reportAudioError('HTML 音訊解碼失敗：'+(audio.error?.code||'unknown'),word.en);
    };
    clearTimeout(pageSpeech.watchdog);
    const start=()=>{
      try{
        const p=audio.play();
        if(p&&typeof p.catch==='function')p.catch(e=>{
          if(pageSpeech.active&&token===pageSpeech.token&&index===pageSpeech.index){
            reportAudioError('HTML 音訊播放被阻擋：'+(e?.name||'error'),String(e));
          }
        });
      }catch(e){reportAudioError('HTML 音訊播放失敗',String(e));}
    };
    start();
    pageSpeech.watchdog=setTimeout(()=>{
      if(pageSpeech.active&&token===pageSpeech.token&&index===pageSpeech.index){
        if(audio.paused||audio.currentTime<0.15){
          reportAudioError('HTML 音訊沒有真正開始播放', 'paused='+audio.paused+'; currentTime='+audio.currentTime+'; elapsed='+ (Date.now()-startTime));
        }
      }
    },3500);
  }
  function speakNextWord(token){
    if(!pageSpeech.active||token!==pageSpeech.token)return;
    if(pageSpeech.index>=pageSpeech.words.length){stopPageSpeech();return;}
    const index=pageSpeech.index,word=pageSpeech.words[index];
    const b64=offlineClipFor(word.en);
    pageSpeech.started=false;highlightSpeakingWord();updateSpeechButton();
    clearTimeout(pageSpeech.watchdog);
    if(b64){
      if(audioMode()==='media')return playOfflineMedia(token,index,b64);
      if(pageSpeech.ctx)return void playOfflineWebAudio(token,index,b64);
      return playOfflineMedia(token,index,b64,'Web Audio 不可用');
    }
    speakNativeWord(token,index,'未找到內建音檔');
  }
  function startPageSpeech(words){
    if(pageSpeech.active)stopPageSpeech();
    if(!words.length)return toast('本頁沒有可以朗讀的單字');
    if(!speechAvailable()&&!words.some(w=>offlineClipFor(w.en))){
      return toast('本頁沒有內建音檔，手機也沒有語音服務');
    }
    pageSpeech.token++;pageSpeech.active=true;pageSpeech.words=words;
    pageSpeech.index=0;pageSpeech.started=false;pageSpeech.signature=pageSignature(words);
    pageSpeech.engine=audioMode()==='media'?'HTML 音訊（Blob）':'Web Audio';
    audioDiagnosis.error='';updateSpeechButton();
    if(audioMode()!=='media'&&words.some(w=>offlineClipFor(w.en))){
      try{unlockWebAudio();}catch(e){markAudio('Web Audio 不可用',String(e),String(e));}
    }
    speakNextWord(pageSpeech.token);
  }
  function togglePageSpeech(){
    if(pageSpeech.active){stopPageSpeech();return;}
    const words=sortedWords().slice(currentPage*pageSizeForView(),(currentPage+1)*pageSizeForView())
      .filter(w=>clean(w.en)).map(w=>({id:w.id,en:w.en}));
    startPageSpeech(words);
  }
  function showAudioDiagnosis(){
    const list=sortedWords().slice(currentPage*pageSizeForView(),(currentPage+1)*pageSizeForView());
    const first=list[0]?.en||'無';const clip=offlineClipFor(first);
    const urlType=location.protocol==='content:'?'Android 下載檔（content://）':location.protocol==='https:'?'HTTPS 網頁':location.protocol==='file:'?'本機檔案':'其他（'+location.protocol+'）';
    const body=`<div class="plain-note">這裡只檢查音訊功能，不會傳送你的單字、標籤或說明。</div>
      <div class="audio-debug-box">頁面來源：${esc(urlType)}<br>目前單字：${esc(first)}<br>內建音檔：${clip?'有':'無'}<br>Web Audio：${AudioContextCtor?'支援':'不支援'}<br>AudioContext：${esc(pageSpeech.ctx?.state||'尚未建立')}<br>目前方式：${esc(audioMode()==='media'?'HTML 音訊':'Web Audio')}<br>最後狀態：<span id="audio-debug-state">${esc(audioDiagnosis.stage)}｜${esc(audioDiagnosis.progress)}</span><br>錯誤：<span id="audio-debug-error">${esc(audioDiagnosis.error||'目前沒有記錄到錯誤')}</span></div>
      <div class="separator-label">播放方式</div>
      <div class="two-cols"><button type="button" class="btn ${audioMode()==='webaudio'?'btn-primary':''}" id="audio-mode-web">Web Audio</button><button type="button" class="btn ${audioMode()==='media'?'btn-primary':''}" id="audio-mode-html">HTML 音訊</button></div>
      <div class="separator-label">測試</div>
      <p class="field-note">點「試播第一個字」，測試本頁第一筆；如果一種方式無聲，試試另一種。下方原生音訊播放器可用來確認瀏覽器能否在 Wordbook 內直接出聲。</p>
      <button type="button" class="btn btn-primary" id="audio-test-first" style="width:100%;margin-bottom:12px">試播第一個字</button>
      <audio id="audio-native-probe" controls preload="none" style="width:100%;height:44px" aria-label="朗讀音檔測試"></audio>
      <button type="button" class="btn btn-ghost" id="audio-copy-report" style="width:100%;margin-top:12px">複製診斷資料</button>`;
    openSheet('語音診斷',body);
    function setMode(mode){stopPageSpeech();state.settings.audioMode=mode;persist();showAudioDiagnosis();}
    $('#audio-mode-web').onclick=()=>setMode('webaudio');
    $('#audio-mode-html').onclick=()=>setMode('media');
    $('#audio-test-first').onclick=()=>{
      closeSheet();const firstWord=list[0];if(firstWord)startPageSpeech([{id:firstWord.id,en:firstWord.en}]);
    };
    const probe=$('#audio-native-probe');
    if(clip){
      const probeURL=URL.createObjectURL(new Blob([bytesFromBase64(clip)],{type:'audio/mpeg'}));
      probe.src=probeURL;
      probe.addEventListener('error',()=>markAudio('原生播放器錯誤','code='+ (probe.error?.code||'?')));
      // Revoke when probe node is detached; a fresh URL is created on next opening.
      probe.addEventListener('ended',()=>{URL.revokeObjectURL(probeURL);probe.removeAttribute('src');});
    }else probe.outerHTML='<p class="field-note">本頁第一個單字沒有預設音檔，請切換至其他收藏單字測試。</p>';
    $('#audio-copy-report').onclick=async()=>{
      const report=`Wordbook v2.1.9\n來源：${location.protocol}\n瀏覽器：${navigator.userAgent}\n內建音檔：${Object.keys(voiceClips).length}\n目前字：${audioDiagnosis.word||first}\n模式：${audioMode()}\nAudioContext：${pageSpeech.ctx?.state||'未建立'}\n最後狀態：${audioDiagnosis.stage}\n進度：${audioDiagnosis.progress}\n錯誤：${audioDiagnosis.error||'無'}\n時間：${audioDiagnosis.lastUpdate}`;
      try{await navigator.clipboard.writeText(report);toast('已複製語音診斷資料');}
      catch(e){
        const txt=document.createElement('textarea');txt.value=report;txt.style.width='100%';$('#modal-layer .sheet-content').appendChild(txt);txt.select();
        try{document.execCommand('copy');toast('已選取診斷資料，請複製');}catch(e2){toast('請長按複製下方的診斷資料');}
      }
    };
  }
  function persist(){
    // Never store private vocabulary in unscoped localStorage. The cloud adapter
    // writes a per-user IndexedDB cache, queues RLS-authorized cloud changes,
    // and wipes the cache on sign-out.
    if(window.WordbookCloud?.isReady){
      window.WordbookCloud.localChange(JSON.parse(JSON.stringify(state)));
    }
    const label=$('#saved-status');if(label)label.textContent=window.WordbookCloud?.isReady?'儲存中…':'尚未登入';
  }
  function activeTagOrder(){
    if(!state.settings.tag)return null;
    const config=state.tagOrders?.[state.settings.tag];
    return config?.enabled===true?config:null;
  }
  function pageSizeForView(){
    const config=activeTagOrder();
    return config&&TAG_PAGE_SIZES.includes(Number(config.pageSize))?Number(config.pageSize):PAGE_SIZE;
  }
  function sortedWords(overrides={}){
    // Overrides are used only to calculate a word's position in the
    // complete notebook. The current tag/search filters remain untouched.
    const query=overrides.search===undefined?state.settings.search:overrides.search;
    const tag=overrides.tag===undefined?state.settings.tag:overrides.tag;
    const pos=overrides.pos===undefined?state.settings.pos:overrides.pos;
    const q=norm(query);
    const list=state.words.filter(w=>hasPosGroup(w,pos) && (!tag || w.tags.includes(tag)) && (!q || norm(w.en).includes(q)||norm(w.zh).includes(q)||norm(w.note).includes(q)));
    const cmp=(a,b)=>a.en.localeCompare(b.en,'en',{sensitivity:'base',numeric:true});
    const config=tag&&state.tagOrders?.[tag]?.enabled===true?state.tagOrders[tag]:null;
    if(config){
      const index=new Map((config.order||[]).map((id,i)=>[String(id),i]));
      list.sort((a,b)=>{
        const ai=index.has(a.id)?index.get(a.id):Infinity;
        const bi=index.has(b.id)?index.get(b.id):Infinity;
        return ai-bi||cmp(a,b);
      });
    }else{
      const sort=state.settings.sort;
      if(sort==='az')list.sort(cmp);
      else if(sort==='za')list.sort((a,b)=>-cmp(a,b));
      else if(sort==='old')list.sort((a,b)=>safeDate(a.createdAt)-safeDate(b.createdAt)||cmp(a,b));
      else list.sort((a,b)=>safeDate(b.createdAt)-safeDate(a.createdAt)||cmp(a,b));
    }
    return list;
  }
  function fullBookPages(){
    return new Map(sortedWords({search:'',tag:'',pos:''}).map((w,i)=>[w.id,Math.floor(i/PAGE_SIZE)+1]));
  }
  function clearSearchAndRestore(){
    if(!state.settings.search)return;
    state.settings.search='';
    currentPage=searchOriginPage??0;
    searchOriginPage=null;
    highlightedWordId='';
    render();
  }
  function jumpToWordInBook(id){
    const all=sortedWords({search:'',tag:'',pos:''});
    const at=all.findIndex(w=>w.id===id);
    if(at<0){toast('這個單字已不存在，請重新搜尋');return false;}
    const hadFilters=!!(state.settings.tag||state.settings.pos);
    state.settings.search='';
    state.settings.tag='';
    state.settings.pos='';
    searchOriginPage=null;
    highlightedWordId=id;
    const targetPage=Math.floor(at/PAGE_SIZE);
    currentPage=targetPage;
    closeSheet();
    if(hadFilters)persist();
    render();
    toast('已前往「'+all[at].en+'」· 第 '+(targetPage+1)+' 頁',4500);
    return true;
  }
  function render(direction=''){
    const pageSize=pageSizeForView(),list=sortedWords(),pages=Math.max(1,Math.ceil(list.length/pageSize));
    currentPage=Math.max(0,Math.min(currentPage,pages-1));
    if(window.WordbookCloud?.isReady)rememberPage();
    const offset=currentPage*pageSize,slice=list.slice(offset,offset+pageSize);
    // Reading is bound to exactly the visible words, not the next page after
    // a swipe, a search, or a change in sort/filter order.
    if(pageSpeech.active&&pageSpeech.signature!==pageSignature(slice))stopPageSpeech();
    const fullPages=state.settings.search?fullBookPages():null;
    let html='';
    if(!list.length){
      html=`<div class="blank-state"><strong>${state.words.length?'找不到符合的單字':'開始寫下第一個單字'}</strong><small>${state.words.length?'試試不同的搜尋、詞性或標籤':'按右上方 ＋ 新增英文單字'}</small></div>`;
    }else for(let i=0;i<pageSize;i++){
      const w=slice[i];
      if(!w){
        html+=`<div class="word-row word-empty"><span class="line-no">${String(offset+i+1).padStart(2,'0')}</span></div>`;
        continue;
      }
      const selected=highlightedWordId===w.id?' word-jump-highlight':'';
      const item=`<button class="word-row${selected}" data-word-id="${esc(w.id)}" type="button" aria-label="查看 ${esc(w.en)}：${esc(w.zh)}"><span class="line-no">${String(offset+i+1).padStart(2,'0')}</span><span class="word-text"><span class="word-en">${esc(w.en)}</span><span class="word-zh">${esc(w.zh)}</span></span>${state.settings.tag==='星座'&&activeTagOrder()?.showDates&&ZODIAC_DATES[w.en]?`<span class="word-date">${esc(ZODIAC_DATES[w.en])}</span>`:''}</button>`;
      const sourcePage=fullPages?.get(w.id);
      html+=fullPages&&sourcePage
        ?`<div class="search-result-wrap">${item}<button class="search-result-goto" data-goto-word="${esc(w.id)}" type="button" aria-label="前往 ${esc(w.en)} 在完整單字本第 ${sourcePage} 頁">原頁 ${sourcePage} ↗</button></div>`
        :item;
    }
    $('#word-list').style.gridTemplateRows='repeat('+pageSize+',minmax(0,1fr))';
    $('#word-list').innerHTML=html;
    $('#read-page-btn').disabled=!slice.length;
    updateSpeechButton();
    highlightSpeakingWord();
    $('#sort-label').textContent=activeTagOrder()?'標籤內 · 自訂順序':(SORTS.find(x=>x[0]===state.settings.sort)?.[1]||SORTS[0][1]);
    $('#total-label').textContent=`我的英文單字本 · ${state.words.length} 個單字`;
    $('#page-current').textContent=String(currentPage+1).padStart(2,'0');
    $('#page-total').textContent=String(pages).padStart(2,'0');
    $('#paper-caption').textContent=slice.length?`${String(offset+1).padStart(2,'0')} — ${String(offset+slice.length).padStart(2,'0')}`:'—';
    $('#page-range').textContent=state.settings.search?'搜尋結果 · 點頁碼跳頁':'點頁碼快速跳頁';
    $('#prev-btn').disabled=currentPage===0;$('#next-btn').disabled=currentPage>=pages-1;
    const filter=$('#active-filter');
    const activeParts=[];
    if(state.settings.pos)activeParts.push('詞性：'+(POS_GROUPS.find(([key])=>key===state.settings.pos)?.[1]||'其他'));
    if(state.settings.tag)activeParts.push('# '+state.settings.tag);
    if(state.settings.search)activeParts.push('搜尋：'+state.settings.search);
    filter.hidden=!activeParts.length;
    $('#active-filter-text').textContent=activeParts.join(' · ');
    $('#clear-search-btn').hidden=!state.settings.search;
    filter.title=activeParts.join(' · ');
    if(direction){const page=$('#paper-page');page.classList.remove('flip-next','flip-prev');void page.offsetWidth;page.classList.add(direction==='next'?'flip-next':'flip-prev');}
  }
  function setPage(num){const next=Math.max(0,Math.min(Math.max(0,Math.ceil(sortedWords().length/pageSizeForView())-1),num));if(next===currentPage)return;const direction=next>currentPage?'next':'prev';highlightedWordId='';currentPage=next;render(direction);}
  function pageJumpSheet(){
    const pageSize=pageSizeForView(),pages=Math.max(1,Math.ceil(sortedWords().length/pageSize));
    const here=currentPage+1;
    const body=`<p class="plain-note">目前第 <b>${here}</b> 頁，共 <b>${pages}</b> 頁，每頁最多 ${pageSize} 個單字。可直接輸入頁數或拖曳進度條。</p>
      <div class="field page-jump-number"><label for="jump-page-number">前往第幾頁</label><input id="jump-page-number" class="text-input" type="number" inputmode="numeric" min="1" max="${pages}" step="1" value="${here}" aria-label="目標頁數"></div>
      <div class="page-jump-slider-row"><span>1</span><input id="jump-page-slider" type="range" min="1" max="${pages}" value="${here}" step="1" aria-label="拖曳選擇頁數" ${pages===1?'disabled':''}><span>${pages}</span></div>
      <div class="page-jump-shortcuts"><button id="jump-first" type="button">第一頁</button><button id="jump-last" type="button">最後一頁</button></div>`;
    openSheet('快速跳頁',body,[{text:'取消',kind:'btn-ghost',action:closeSheet},{text:'前往此頁',kind:'btn-primary',action:()=>jump($('#jump-page-number').value)}]);
    const input=$('#jump-page-number'),slider=$('#jump-page-slider');
    const clamp=value=>Math.max(1,Math.min(pages,Math.trunc(Number(value)||1)));
    const jump=value=>{closeSheet();setPage(clamp(value)-1);};
    slider.oninput=()=>{input.value=slider.value;};
    input.oninput=()=>{if(input.value&&Number.isFinite(Number(input.value)))slider.value=String(clamp(input.value));};
    input.onchange=()=>{input.value=String(clamp(input.value));slider.value=input.value;};
    input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();jump(input.value);}};
    $('#jump-first').onclick=()=>jump(1);
    $('#jump-last').onclick=()=>jump(pages);
  }
  function toast(message,duration=3600){const el=$('#toast');el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,duration);}
  function closeSheet(){const el=$('#modal-layer');el.hidden=true;el.innerHTML='';activeSheet='';document.body.style.overflow='';}
  function openSheet(title,body,actions=[],opts={}){
    if(pageSpeech.active)stopPageSpeech();
    const layer=$('#modal-layer');activeSheet=title;layer.hidden=false;
    layer.innerHTML=`<section class="sheet ${opts.tall?'tall':''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="sheet-head"><h2>${esc(title)}</h2><button class="sheet-close" type="button" data-close aria-label="關閉">×</button></header><div class="sheet-content">${body}</div>${actions.length?`<div class="sheet-actions">${actions.map((a,i)=>`<button type="button" id="modal-action-${i}" class="btn ${a.kind||''}">${esc(a.text)}</button>`).join('')}</div>`:''}</section>`;
    actions.forEach((a,i)=>$(`#modal-action-${i}`,layer).onclick=a.action);
    $('[data-close]',layer).onclick=closeSheet;
    layer.onclick=e=>{if(e.target===layer)closeSheet();};
    if(opts.autofocus)setTimeout(()=>$(opts.autofocus,layer)?.focus(),120);
  }
  function wordEditor(id=''){
    const word=id?state.words.find(w=>w.id===id):null;
    if(id&&!word)return toast('找不到這個單字');
    const posSelect=POS.map(([key,label])=>`<label class="tag-chip pos-chip ${posItems(word?.pos).includes(key)?'checked':''}"><input type="checkbox" name="word-pos" value="${esc(key)}" ${posItems(word?.pos).includes(key)?'checked':''}>${esc(label)}</label>`).join('');
    const tags=state.tags.length?state.tags.map(t=>`<label class="tag-chip ${word?.tags.includes(t)?'checked':''}"><input type="checkbox" name="word-tag" value="${esc(t)}" ${word?.tags.includes(t)?'checked':''}>${esc(t)}</label>`).join(''):'<span class="helper-text">你可以在「更多 → 管理標籤」新增自訂分類。</span>';
    const originals=word?.originals||[];
    // Source bytes remain unchanged in JSON; display old Simplified Chinese in
    // Traditional script so every translation seen in the notebook is zh-TW.
    const translations=[...new Set(originals.map(r=>`${r.from?.startsWith('中文')?toTraditionalZh(r.originalSource,word.en):r.originalSource} → ${r.to?.startsWith('中文')?toTraditionalZh(r.originalTarget,word.en):r.originalTarget}（${r.from} → ${r.to}）`))];
    const body=`<form id="word-form" autocomplete="off"><div class="field"><label for="word-en">English</label><input id="word-en" class="text-input" maxlength="140" required value="${esc(word?.en||'')}" placeholder=""></div>
      <div class="field"><div class="field-heading"><label for="word-zh">中文</label></div><input id="word-zh" class="text-input" maxlength="260" required value="${esc(word?.zh||'')}" placeholder=""><div class="translation-hint" id="lookup-status"></div><div class="translate-open-row"><a id="google-open" class="external-mini" target="_blank" rel="noopener noreferrer" href="https://translate.google.com/">在 Google 翻譯網頁開啟 ↗</a><button type="button" class="external-copy" id="google-copy">複製英文</button></div></div>
      <div class="field"><label for="word-note">進一步說明／解析</label><textarea id="word-note" class="text-area word-note" rows="1" maxlength="3500">${esc(word?.note||'')}</textarea></div>
      <div class="field"><div class="field-heading"><span class="field-label" style="margin:0">詞性</span></div><div class="tag-cloud pos-list">${posSelect}</div><div class="translation-hint" id="pos-status">${esc(word?.posSource==='dictionaryapi.dev'?'已由線上字典確認':word?.posSource==='manual'?'個人自訂詞性':'離線預填詞性，尚待線上字典校正')}</div></div>
      <div class="field"><div class="field-label">標籤</div><div class="tag-cloud">${tags}</div></div>
      ${originals.length?`<details class="source-variants"><summary>Google 原收藏紀錄（${originals.length} 筆）${originals.length>1?' · 含其他譯法':''}</summary><div class="original-list">${translations.map(t=>`<div>${esc(t)}</div>`).join('')}</div><p class="field-note">顯示已統一正體中文；原始 Google 收藏文字仍保留在備份中供核對，不會覆蓋你修改過的中文。</p></details>`:''}
      ${word?`<p class="helper-text">來源：${esc(word.source||'手動新增')} · 加入於 ${esc(new Date(word.createdAt).toLocaleDateString('zh-TW'))}</p>`:''}</form>${word?'<div class="footer-danger"><button type="button" id="word-delete" class="btn btn-danger">刪除此單字</button></div>':''}`;
    openSheet(word?'單字與說明':'新增單字',body,[{text:'取消',kind:'btn-ghost',action:closeSheet},{text:'儲存單字',kind:'btn-primary',action:()=>{
      const en=clean($('#word-en').value).replace(/\s+/g,' '),zh=toTraditionalZh($('#word-zh').value,en),note=clean($('#word-note').value);
      if(!en||!zh)return toast('請填入英文及中文');
      if(state.words.some(w=>w.id!==id&&norm(w.en)===norm(en)))return toast('這個單字已存在，請直接搜尋並修改原本那一筆');
      const pos=posString($$('input[name="word-pos"]:checked').map(x=>x.value).join(',')),tags=$$('input[name="word-tag"]:checked').map(x=>x.value),now=timeNow();
      const posSource=posEdited?'manual':(lookupPosSource||(word?.posSource||''));
      if(word){Object.assign(word,{en,zh,note,pos,posSource,tags,updatedAt:now});}
      else{state.words.push(fixWord({id:uuid(),en,zh,note,pos,posSource,tags,source:'手動新增',originals:[],createdAt:now,updatedAt:now}));currentPage=0;}
      state.deletedKeys=state.deletedKeys.filter(k=>k!==norm(en));persist();closeSheet();render();toast(word?'已儲存修改':'已加入單字本');
    }}],{autofocus:word?'':'#word-en',tall:true});
    // Keep notes as one line by default, even when prefilled. The native
    // textarea resize grip is user-controlled; don't auto-grow on typing.
    $('#word-form').onsubmit=e=>{e.preventDefault();$('#modal-action-1').click();};
    if(word)$('#word-delete').onclick=()=>{
      if(!confirm(`確定刪除「${word.en}」？`))return;
      state.deletedKeys=[...new Set([...state.deletedKeys,norm(word.en)])];
      state.words=state.words.filter(w=>w.id!==word.id);persist();closeSheet();render();toast('已刪除單字');
    };
    const enInput=$('#word-en'),zhInput=$('#word-zh'),status=$('#lookup-status'),open=$('#google-open'),posStatus=$('#pos-status');
    let posEdited=false,zhEdited=false,lookupPosSource=word?.posSource||'',autoTimer=0,lookupSerial=0,autoFilledZh='',autoFilledPos=[];
    const saveBtn=$('#modal-action-1');
    const busy=on=>{saveBtn.disabled=on;saveBtn.textContent=on?'正在自動查詢…':'儲存單字';};
    $$('.tag-chip',$('#modal-layer')).forEach(chip=>chip.addEventListener('change',()=>{
      chip.classList.toggle('checked',$('input',chip).checked);
      if(chip.classList.contains('pos-chip'))posEdited=true;
    }));
    // Android Translate app often discards web URL parameters (text/sl/tl).
    // Explicitly request Chrome for the *web* destination instead of letting
    // Android App Links route this URL to the native Translate app.
    const googleCopy=$('#google-copy');
    const isAndroid=/Android/i.test(navigator.userAgent);
    const currentEnglish=()=>clean(enInput.value).replace(/\s+/g,' ');
    const translateWebUrl=en=>'https://translate.google.com/?sl=en&tl=zh-TW&text='+encodeURIComponent(en)+'&op=translate';
    const chromeWebIntent=(en,url)=>'intent://translate.google.com/?sl=en&tl=zh-TW&text='+encodeURIComponent(en)+'&op=translate#Intent;scheme=https;action=android.intent.action.VIEW;package=com.android.chrome;S.browser_fallback_url='+encodeURIComponent(url)+';end';
    const setLink=()=>{
      const en=currentEnglish(),url=translateWebUrl(en);
      // Keep the real HTTPS target accessible for debugging and fallback.
      open.dataset.webUrl=url;
      open.href=isAndroid?chromeWebIntent(en,url):url;
      if(isAndroid)open.removeAttribute('target');
      else open.target='_blank';
    };
    setLink();
    open.addEventListener('click',event=>{
      if(!currentEnglish()){event.preventDefault();toast('\u8acb\u5148\u8f38\u5165\u82f1\u6587\u55ae\u5b57');return;}
      setLink();
    });
    googleCopy.onclick=async()=>{
      const en=currentEnglish();
      if(!en)return toast('\u8acb\u5148\u8f38\u5165\u82f1\u6587\u55ae\u5b57');
      let copied=false;
      try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(en);copied=true;}}catch(e){}
      if(!copied){
        const area=document.createElement('textarea');
        area.value=en;area.setAttribute('readonly','');
        area.style.position='fixed';area.style.top='-9999px';
        document.body.appendChild(area);area.select();
        try{copied=document.execCommand('copy');}catch(e){}
        area.remove();
      }
      toast(copied?'\u5df2\u8907\u88fd\u82f1\u6587\uff0c\u53ef\u76f4\u63a5\u8cbc\u4e0a':'\u8907\u88fd\u5931\u6557\uff0c\u8acb\u624b\u52d5\u9078\u53d6\u82f1\u6587');
    };
    const valid=(id,en)=>id===lookupSerial&&enInput.isConnected&&currentEnglish()===en;
    const changePos=values=>$$('.pos-chip input').forEach(input=>{
      input.checked=values.includes(input.value);
      input.closest('.pos-chip').classList.toggle('checked',input.checked);
    });
    const autoLookup=async(id,en)=>{
      if(!valid(id,en))return;
      const jobs=[];
      if(!zhEdited&&!clean(zhInput.value)&&state.translatorUrl){
        status.textContent='正在取得 Google 中文…';
        jobs.push(googleLookup(en).then(zh=>{
          if(!valid(id,en)||zhEdited||clean(zhInput.value))return;
          zhInput.value=zh;autoFilledZh=zh;status.textContent='已帶入 Google 中文，可自行修改。';
        }).catch(err=>{if(valid(id,en))status.textContent='中文查詢失敗：'+err.message;}));
      }
      if(!posEdited&&!$$('input[name="word-pos"]:checked').length){
        if(en.includes(' ')){
          changePos(['phrase']);autoFilledPos=['phrase'];lookupPosSource='phrase-rule';
          posStatus.textContent='已自動歸類片語，可自行修改。';
        }else if(window.WordbookCloud?.lookupPartOfSpeech){
          posStatus.textContent='正在辨識詞性…';
          jobs.push(window.WordbookCloud.lookupPartOfSpeech(en).then(r=>{
            if(!valid(id,en)||posEdited)return;
            const values=posItems(r?.pos||[]);
            if(values.length){
              changePos(values);autoFilledPos=values;lookupPosSource=r.source||'dictionary';
              posStatus.textContent='已自動帶入 '+values.map(x=>POS.find(([k])=>k===x)?.[1]||x).join('、')+'；可自行修改。';
            }else posStatus.textContent='詞性尚未確認，可自行勾選。';
          }).catch(()=>{if(valid(id,en))posStatus.textContent='詞性查詢暫時失敗，可自行勾選。';}));
        }
      }
      await Promise.allSettled(jobs);
      if(valid(id,en))busy(false);
    };
    zhInput.addEventListener('input',()=>{zhEdited=true;autoFilledZh='';});
    enInput.oninput=()=>{
      setLink();clearTimeout(autoTimer);lookupSerial++;
      if(autoFilledZh&&zhInput.value===autoFilledZh&&!zhEdited){zhInput.value='';autoFilledZh='';}
      if(autoFilledPos.length&&!posEdited){changePos([]);autoFilledPos=[];lookupPosSource='';}
      const en=currentEnglish();
      if(word||en.length<2||!/[a-z]/i.test(en)){busy(false);return;}
      const id=lookupSerial;busy(true);autoTimer=setTimeout(()=>autoLookup(id,en),650);
    };

  }
  async function dictionaryLookup(en){
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),13500);
    try{
      const resp=await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/'+encodeURIComponent(en),{signal:abort.signal,cache:'force-cache'});
      if(resp.status===404){const err=new Error('字典沒有這個詞條');err.code='NOT_FOUND';throw err;}
      if(resp.status===429){const err=new Error('字典暫時限制查詢次數，請稍後繼續');err.code='RATE_LIMIT';throw err;}
      if(!resp.ok)throw new Error('字典服務暫時無法使用 (HTTP '+resp.status+')');
      const records=await resp.json();
      const raw=Array.isArray(records)?records.flatMap(r=>Array.isArray(r.meanings)?r.meanings.map(m=>m.partOfSpeech):[]):[];
      const values=posItems(raw.join(','));
      if(!values.length)throw new Error('字典未提供可用詞性');
      return values;
    }catch(err){if(err.name==='AbortError')throw new Error('字典連線逾時');throw err;}
    finally{clearTimeout(timer);}
  }
  async function googleLookup(en){
    const endpoint=state.translatorUrl;
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec\/?$/.test(endpoint))throw new Error('請先設定有效的 Google Apps Script 網址');
    return new Promise((resolve,reject)=>{
      const callback='wbReply_'+Date.now()+'_'+Math.random().toString(36).slice(2,10);
      const s=document.createElement('script');s.async=true;
      const url=new URL(endpoint);url.searchParams.set('q',en);url.searchParams.set('callback',callback);
      let finished=false,timer;
      const finish=(err,val)=>{if(finished)return;finished=true;clearTimeout(timer);s.remove();delete window[callback];if(err)reject(err);else resolve(val);};
      window[callback]=payload=>{
        const result=clean(payload?.zh||payload?.translatedText||'');
        if(payload?.ok && result)finish(null,toTraditionalZh(result,en));else finish(new Error(escapeHeader(payload?.error||'翻譯服務未回傳結果')));
      };
      s.onerror=()=>finish(new Error('連線失敗，請確認部署權限與網址'));
      timer=setTimeout(()=>finish(new Error('連線逾時，請稍後再試')),12000);
      s.src=url.toString();document.head.appendChild(s);
    });
  }
  function sortSheet(){
    // Changing a sort or filter should not jump back to the beginning of this sheet.
    const scrollPosition=$('#modal-layer .sheet-content')?.scrollTop||0;
    const body=`<div class="separator-label">排列方式</div>
      <div class="choice-list">${SORTS.map(([id,label])=>`<button class="choice ${state.settings.sort===id?'selected':''}" data-sort="${id}" type="button"><span class="sort-choice-text">${esc(label)}</span></button>`).join('')}</div>
      <p class="field-note">CSV 沒有每筆收藏日期；舊收藏依原 CSV 順序排列，新加入的單字才有實際新增時間。${activeTagOrder()?'<br><b>目前標籤已啟用獨立自訂排序。</b>':''}</p>
      <div class="separator-label">詞性篩選</div>
      <div class="tag-cloud pos-filter-options" role="group" aria-label="依詞性篩選">
        <button class="tag-chip ${!state.settings.pos?'selected':''}" data-pos-filter="" type="button" aria-pressed="${!state.settings.pos}">全部詞性</button>
        ${POS_GROUPS.map(([key,label])=>`<button class="tag-chip ${state.settings.pos===key?'selected':''}" data-pos-filter="${key}" type="button" aria-pressed="${state.settings.pos===key}">${label}</button>`).join('')}
      </div>
      <p class="field-note">片語與未歸類詞性列入「其他」；同一單字有多個詞性時，可在不同詞性篩選中找到。</p>
      <div class="separator-label">標籤篩選</div>
      <div class="tag-cloud"><button class="tag-chip ${!state.settings.tag?'selected':''}" data-filter="" type="button">全部單字</button>${state.tags.map(t=>`<button class="tag-chip ${state.settings.tag===t?'selected':''}" data-filter="${esc(t)}" type="button">${esc(t)}</button>`).join('')}</div>
      ${state.settings.tag?`<button type="button" id="selected-tag-order" class="subtle-link">調整「${esc(state.settings.tag)}」的標籤排序 ↗</button>`:''}`;
    openSheet('排序與篩選',body,[{text:'完成',kind:'btn-primary',action:closeSheet}]);
    $('#modal-layer .sheet-content').scrollTop=scrollPosition;
    $$('[data-sort]',$('#modal-layer')).forEach(b=>b.onclick=()=>{state.settings.sort=b.dataset.sort;currentPage=0;persist();render();sortSheet();});
    $$('[data-pos-filter]',$('#modal-layer')).forEach(b=>b.onclick=()=>{state.settings.pos=b.dataset.posFilter;currentPage=0;persist();render();sortSheet();});
    $$('[data-filter]',$('#modal-layer')).forEach(b=>b.onclick=()=>{state.settings.tag=b.dataset.filter;currentPage=0;persist();render();sortSheet();});
    if($('#selected-tag-order'))$('#selected-tag-order').onclick=()=>tagOrderSheet(state.settings.tag);
  }
  function searchSheet(){
    const body=`<div class="field"><label for="search-text">搜尋英文、中文或說明</label>
      <input id="search-text" type="search" class="text-input" value="${esc(state.settings.search||'')}" placeholder="例如 silver-tongued" autocomplete="off"></div>
      <div class="separator-label">快速前往完整單字本</div>
      <div id="search-quick-results" class="search-quick-results" aria-live="polite"></div>
      <p class="field-note">點選下方的單字可直接跳到原始頁數；選「搜尋」則只顯示符合的結果。說明欄也會納入比對。</p>`;
    openSheet('搜尋單字',body,[
      {text:'清除搜尋',kind:'btn-ghost',action:()=>{closeSheet();clearSearchAndRestore();}},
      {text:'搜尋',kind:'btn-primary',action:()=>{
        const value=clean($('#search-text').value);
        if(value&&!state.settings.search)searchOriginPage=currentPage;
        state.settings.search=value;
        highlightedWordId='';
        if(value)currentPage=0;
        else{currentPage=searchOriginPage??currentPage;searchOriginPage=null;}
        closeSheet();render();
      }}
    ],{autofocus:'#search-text'});
    const input=$('#search-text'),suggestions=$('#search-quick-results');
    const refreshSuggestions=()=>{
      if(!suggestions?.isConnected)return;
      const query=clean(input.value);
      if(!query){
        suggestions.innerHTML='<p class="search-quick-empty">輸入英文或中文，即可顯示相符單字的原始頁碼。</p>';
        return;
      }
      const matches=sortedWords({search:query,tag:'',pos:''});
      if(!matches.length){
        suggestions.innerHTML='<p class="search-quick-empty">找不到符合的單字</p>';
        return;
      }
      const pages=fullBookPages();
      const rows=matches.slice(0,8).map(w=>{
        const page=pages.get(w.id)||1;
        return `<button class="search-quick-item" type="button" data-quick-goto="${esc(w.id)}" aria-label="前往 ${esc(w.en)}，完整單字本第 ${page} 頁"><span class="search-quick-word"><strong>${esc(w.en)}</strong><small>${esc(w.zh)}</small></span><span class="search-quick-page">第 ${page} 頁 ↗</span></button>`;
      }).join('');
      suggestions.innerHTML=`<div class="search-quick-count">符合 ${matches.length} 筆${matches.length>8?' · 顯示前 8 筆':''}</div>${rows}`;
      $$('[data-quick-goto]',suggestions).forEach(button=>button.onclick=()=>jumpToWordInBook(button.dataset.quickGoto));
    };
    input.addEventListener('input',refreshSuggestions);
    input.onkeydown=e=>{if(e.key==='Enter'){$('#modal-action-1').click();}};
    refreshSuggestions();
  }
  // User-initiated, resumable enrichment; no AI keys and no automatic mass requests.
  let bulkRun=null;
  const eligibleForPos=w=>isSingleWord(w.en)&&w.posSource!=='dictionaryapi.dev'&&w.posSource!=='manual'&&w.posSource!=='legacy'&&w.posSource!=='not-found';
  const bulkPosSummary=()=>{
    const verified=state.words.filter(w=>w.posSource==='dictionaryapi.dev').length;
    const manual=state.words.filter(w=>w.posSource==='manual').length;
    const remaining=state.words.filter(eligibleForPos).length;
    const other=state.words.length-verified-manual-remaining;
    return {verified,manual,remaining,other};
  };
  function posBulkSheet(){
    const info=bulkPosSummary(),running=!!bulkRun;
    const body=`<div class="plain-note"><b>詞性來源：</b>Free Dictionary API（dictionaryapi.dev）。目前內建詞庫已有離線初步分類，但不代表逐筆通過線上查證；多詞性的字會在校正後全部列出。<br>中文與進階說明都不會更改。</div>
    <div class="pos-summary"><div><b>${info.verified}</b><small>字典已確認</small></div><div><b>${info.remaining}</b><small>可繼續查證</small></div><div><b>${info.other}</b><small>片語／非英語等</small></div></div>
    <div class="progress-box"><div id="pos-bulk-status">${running?'查證進行中…':'每次最多查詢 120 個，結束後可繼續；結果會即時儲存。'}</div><div class="progress-track"><div id="pos-bulk-bar" class="progress-fill" style="width:${running?Math.round(bulkRun.done/Math.max(bulkRun.total,1)*100):0}%"></div></div></div>
    <p class="field-note">由你的裝置直接查詢公開字典，不使用 AI token，也不會上傳中文或私人說明。遇到查無結果、網路錯誤或 429 會保留原分類；手動改過的詞性不會被覆寫。</p>`;
    openSheet('批次校正詞性',body,[{text:running?'停止本批':'返回',kind:'btn-ghost',action:()=>{if(bulkRun)bulkRun.cancel=true;closeSheet();}},{text:running?'校正中…':`開始校正（最多 ${Math.min(120,info.remaining)} 字）`,kind:'btn-primary',action:()=>{if(!bulkRun)runPosBatch();}}],{tall:true});
    if(running)$('#modal-action-1').disabled=true;
  }
  async function runPosBatch(){
    if(bulkRun)return;
    const queue=state.words.filter(eligibleForPos).slice(0,120);
    if(!queue.length)return toast('目前已沒有可自動查證的單字');
    const run={done:0,total:queue.length,found:0,notFound:0,errors:0,failStreak:0,cancel:false};bulkRun=run;
    const act=$('#modal-action-1');if(act)act.disabled=true;
    for(const word of queue){
      if(run.cancel)break;
      try{
        const values=await dictionaryLookup(word.en);
        // Don't overwrite a manual edit made while the network response was pending.
        if(word.posSource!=='manual'){
          word.pos=posString(values.join(','));word.posSource='dictionaryapi.dev';word.updatedAt=timeNow();run.found++;run.failStreak=0;
        }
      }catch(err){
        if(err.code==='NOT_FOUND'){word.posSource='not-found';run.notFound++;run.failStreak=0;}
        else{run.errors++;run.failStreak++;if(err.code==='RATE_LIMIT'||run.failStreak>=3){run.cancel=true;}}
      }
      run.done++;
      persist();
      if(activeSheet==='批次校正詞性'&&$('#pos-bulk-status')){
        $('#pos-bulk-status').textContent=`已處理 ${run.done} / ${run.total}，確認 ${run.found}，查無 ${run.notFound}，連線異常 ${run.errors}${run.cancel?'（已停止）':''}`;
        $('#pos-bulk-bar').style.width=Math.round(run.done/run.total*100)+'%';
      }
      // Gentle pacing instead of flooding a free community-run API.
      if(!run.cancel)await new Promise(r=>setTimeout(r,330));
    }
    bulkRun=null;persist();render();
    if(activeSheet==='批次校正詞性')posBulkSheet();
    toast(run.errors>=3&&run.cancel?'字典連續連線失敗，已停止；之前的結果都已儲存':`已查證 ${run.found} 個；查無 ${run.notFound} 個；連線問題 ${run.errors} 個`);
  }
  function moreSheet(){
    const googleCount=state.words.reduce((sum,w)=>sum+(w.originals?.length||0),0);
    const noteCount=state.words.filter(w=>clean(w.note)).length;
    const body=`<div class="plain-note">目前 ${state.words.length} 個單字，其中保存 ${googleCount} 筆 Google 收藏紀錄、${noteCount} 個進階說明。登入後會同步到私人 Supabase；仍建議定期下載 JSON 備份。</div>
      <div class="nav-menu"><button type="button" id="nav-account">帳號與同步 <span>›</span></button><button type="button" id="nav-pos">批次校正詞性 <span>›</span></button><button type="button" id="nav-google">Google 翻譯連線 <span>›</span></button><button type="button" id="nav-audio">HTTPS 語音測試 <span>›</span></button><button type="button" id="nav-import">新增 Google 收藏 CSV <span>›</span></button><button type="button" id="nav-notes">匯入 AI 說明資料包 <span>›</span></button><button type="button" id="nav-tags">管理自訂分類標籤 <span>›</span></button><button type="button" id="nav-export-csv">匯出單字與說明 CSV <span>↓</span></button><button type="button" id="nav-backups">雲端每日備份 <span>›</span></button><button type="button" id="nav-export-json">下載完整 JSON 備份 <span>↓</span></button><button type="button" id="nav-restore">合併／還原 Wordbook 備份 <span>›</span></button></div><p class="field-note">舊資料不會被自動覆寫；未來新增的 AI 截圖說明可用「匯入 AI 說明資料包」合併，不用重新安裝 App。</p>`;
    openSheet('更多功能',body);
    $('#nav-backups').onclick=async()=>{
      openSheet('雲端每日備份',`<div class="plain-note"><b>每天台灣時間 03:05</b> 自動備份 Wordbook 到私人 Supabase Storage。<p>Travel OS 仍於 03:00 獨立備份。Google Drive 雙重備份已啟用：先儲存至 Supabase 私人備份區，再複製至 Travel OS 原有 Google Drive 備份帳號；兩個 App 的檔名不同、排程獨立。</p></div><div id="wordbook-backup-list" class="plain-note">正在讀取備份紀錄…</div>`,[{text:'完成',kind:'btn-primary',action:closeSheet}]);
      const el=$('#wordbook-backup-list');
      try{
        const list=await window.WordbookCloud?.listBackups?.();
        if(!el?.isConnected)return;
        el.innerHTML=(list||[]).length?(list||[]).map((b,i)=>{
          const statusText=b.status==='success'?'雙重備份成功':b.status==='partial'?'部分成功':b.status==='failed'?'備份失敗':'執行中';
          const storageText=b.storage_path?'Supabase ✓':'Supabase 尚未完成';
          const driveText=b.drive_status==='success'?'Google Drive ✓':b.drive_status==='failed'?'Google Drive 失敗':'Google Drive 尚未執行';
          const hasDriveId=/^[A-Za-z0-9_-]{10,110}$/.test(String(b.drive_file_id||''))&&b.drive_status==='success';
          return `<div class="tag-manage-row"><div><b>${esc(new Date(b.started_at).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}))}</b><br><small>${esc(statusText)} · ${Number(b.word_count||0)} 筆 · ${Math.round(Number(b.storage_bytes||0)/1024)} KB</small><br><small>${esc(storageText)} ｜ ${esc(driveText)}</small></div><div class="backup-links">${b.storage_path?`<button class="external-copy" type="button" data-backup-download="${i}">下載</button>`:''}${hasDriveId?`<button class="external-copy" type="button" data-backup-drive="${i}">Drive ↗</button>`:''}</div></div>`;
        }).join(''):'<p>尚未找到備份紀錄。</p>';
        el.querySelectorAll('[data-backup-drive]').forEach(btn=>btn.onclick=()=>{
          const id=String(list[Number(btn.dataset.backupDrive)]?.drive_file_id||'');
          if(!/^[A-Za-z0-9_-]{10,110}$/.test(id)){toast('Google Drive 檔案 ID 無效');return;}
          window.open('https://drive.google.com/file/d/'+encodeURIComponent(id)+'/view','_blank','noopener,noreferrer');
        });
        el.querySelectorAll('[data-backup-download]').forEach(btn=>btn.onclick=async()=>{
          btn.disabled=true;btn.textContent='準備中…';
          try{const url=await window.WordbookCloud.downloadBackupUrl(list[Number(btn.dataset.backupDownload)].storage_path);window.open(url,'_blank','noopener,noreferrer');toast('已建立備份下載連結');}
          catch(e){toast('下載連結建立失敗：'+(e.message||e),7000);}
          finally{btn.disabled=false;btn.textContent='下載';}
        });
      }catch(e){if(el?.isConnected)el.textContent='無法讀取備份紀錄：'+(e?.message||e);}
    };
    $('#nav-account').onclick=()=>{
      openSheet('帳號與同步',`<div class="plain-note">目前登入：${esc(window.WordbookCloud?.currentEmail||'')}
        <p>單字資料儲存在你的私人 Supabase 資料庫。離線編輯會先存到此裝置，連線恢復後嘗試同步。</p>
        <p>狀態：${esc(window.WordbookCloud?.statusText||'準備中')}</p></div>
        <button type="button" class="btn btn-primary" id="sync-now" style="width:100%;margin-bottom:12px">立即同步</button>
        <div class="separator-label">其他裝置登入</div>
        <p class="field-note">新手機或電腦輸入同一個 Email，再填入這裡產生的登入碼即可。有效 60 分鐘、僅能使用一次、最多同時三組；無須收 Email。</p>
        <button type="button" class="btn btn-primary" id="device-code-issue" style="width:100%">產生一次性登入碼</button>
        <div class="device-code-result" id="device-code-result" hidden>
          <span class="field-label">請在新裝置輸入此登入碼</span>
          <strong class="device-code-value" id="device-code-value"></strong>
          <span id="device-code-expiry" class="field-note"></span>
          <button type="button" class="btn btn-ghost" id="device-code-copy">複製登入碼</button>
        </div>
        <button type="button" class="btn btn-ghost" id="cloud-logout" style="width:100%;margin-top:18px">登出並清除本機離線資料</button>`);
      $('#sync-now').onclick=async()=>{await window.WordbookCloud?.syncNow();};
      $('#device-code-issue').onclick=async()=>{
        const btn=$('#device-code-issue');btn.disabled=true;btn.textContent='正在產生…';
        try{
          const response=await window.WordbookCloud.issueDeviceCode();
          $('#device-code-value').textContent=response.code;
          $('#device-code-expiry').textContent='台灣時間到期：'+new Date(response.expiresAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false});
          $('#device-code-result').hidden=false;
          toast('已產生一次性登入碼');
        }catch(err){toast(err?.message||'產生登入碼失敗',6000);}
        finally{btn.disabled=false;btn.textContent='產生另一組登入碼';}
      };
      $('#device-code-copy').onclick=async()=>{
        const code=$('#device-code-value').textContent;
        try{await navigator.clipboard.writeText(code);toast('登入碼已複製');}
        catch(e){toast('請長按登入碼複製');}
      };
      $('#cloud-logout').onclick=()=>window.WordbookCloud?.signOut();
    };
    $('#nav-pos').onclick=posBulkSheet;
    $('#nav-google').onclick=translationSettings;
    $('#nav-audio').onclick=()=>{window.open('./voice-test.html','_blank','noopener');};
    $('#nav-import').onclick=importCSVSheet;
    $('#nav-notes').onclick=importNotesSheet;
    $('#nav-tags').onclick=tagManager;
    $('#nav-export-csv').onclick=exportCSV;
    $('#nav-export-json').onclick=exportJSON;
    $('#nav-restore').onclick=restoreSheet;
  }
  function translationSettings(){
    const body=`<p class="plain-note"><b>Google 自動翻譯</b>需要設定一次你自己的 Google Apps Script；設定成功後，新增英文時可自動帶入繁體中文。App 不會使用不穩定的非官方翻譯接口，也不會把密鑰寫進程式。</p>
      <div class="field"><label for="script-url">Google Apps Script 部署網址（以 /exec 結尾）</label><input class="text-input" id="script-url" type="url" value="${esc(state.translatorUrl)}" placeholder="https://script.google.com/macros/s/.../exec" spellcheck="false"><p class="field-note">ZIP 內附 google-translate.gs 和部署步驟。只會傳送你查詢的英文單字，不傳送單字本、私人註解。</p></div>
      <a class="external-mini" href="https://script.google.com/home/projects/create" rel="noopener noreferrer" target="_blank">建立 Google Apps Script ↗</a>
      <p class="field-note">沒有設定也可手動輸入中文；在新增畫面有「在 Google 翻譯開啟」連結。公開部署網址請勿分享，並注意 Google Apps Script 配額。</p>`;
    openSheet('Google 翻譯連線',body,[{text:'清除連線',kind:'btn-ghost',action:()=>{state.translatorUrl='';persist();translationSettings();toast('連線設定已清除');}},{text:'儲存設定',kind:'btn-primary',action:()=>{
      const url=clean($('#script-url').value).replace(/\/$/,'');
      if(url&&!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))return toast('請輸入合法的 Google Apps Script /exec 網址');
      state.translatorUrl=url;persist();closeSheet();toast(url?'已儲存 Google 翻譯連線':'已清除翻譯連線');
    }}]);
  }
  function tagOrderSheet(tag){
    if(!state.tags.includes(tag))return toast('找不到此標籤');
    const words=state.words.filter(w=>w.tags.includes(tag));
    const saved=state.tagOrders?.[tag];
    const rank=new Map((saved?.order||[]).map((id,i)=>[String(id),i]));
    words.sort((a,b)=>{
      const ai=rank.has(a.id)?rank.get(a.id):Infinity;
      const bi=rank.has(b.id)?rank.get(b.id):Infinity;
      return ai-bi||a.en.localeCompare(b.en,'en',{sensitivity:'base'});
    });
    const defaults={enabled:false,pageSize:PAGE_SIZE,showDates:false,order:words.map(w=>w.id)};
    const cfg={...defaults,...saved};
    const body=`<p class="plain-note">只有選擇「${esc(tag)}」標籤時，才使用這裡的順序；全部單字仍維持字母／時間排序。修改會自動同步雲端。</p>
      <label class="custom-order-switch"><input type="checkbox" id="tag-order-enable" ${cfg.enabled?'checked':''}> 啟用此標籤的自訂排序</label>
      <div class="field"><label for="tag-order-page-size">這個標籤每頁顯示</label><select id="tag-order-page-size" class="select-input">${TAG_PAGE_SIZES.map(n=>`<option value="${n}" ${Number(cfg.pageSize)===n?'selected':''}>${n} 個單字</option>`).join('')}</select></div>
      ${tag==='星座'?`<label class="custom-order-switch"><input type="checkbox" id="tag-order-dates" ${cfg.showDates?'checked':''}> 顯示星座日期</label>`:''}
      <div class="separator-label">自訂順序 · 共 ${words.length} 筆</div>
      <p class="field-note">長按左邊 ≡ 並上下拖曳，或使用 ↑ ↓ 調整順序。</p>
      <div id="tag-order-list" class="tag-order-list">${words.map(w=>`<div class="tag-sort-row" data-order-id="${esc(w.id)}">
        <button class="tag-drag-handle" type="button" aria-label="長按拖曳 ${esc(w.en)}">☰</button>
        <div class="tag-sort-term"><b>${esc(w.en)}</b><small>${esc(w.zh)}${tag==='星座'&&ZODIAC_DATES[w.en]?' · '+esc(ZODIAC_DATES[w.en]):''}</small></div>
        <div class="tag-sort-arrows"><button type="button" data-move="-1" aria-label="${esc(w.en)} 上移">↑</button><button type="button" data-move="1" aria-label="${esc(w.en)} 下移">↓</button></div>
      </div>`).join('')}</div>
      ${words.length?'':'<div class="empty-inline">先把單字加入此標籤，就可以調整順序。</div>'}`;
    openSheet('標籤排序 · '+tag,body,[
      {text:'返回標籤管理',kind:'btn-ghost',action:tagManager},
      {text:'查看此標籤',kind:'btn-primary',action:()=>{
        state.settings.tag=tag;
        state.settings.pos='';state.settings.search='';currentPage=0;
        persist();closeSheet();render();
      }}
    ],{tall:true});
    const list=$('#tag-order-list');
    const update=patch=>{
      state.tagOrders={...state.tagOrders,[tag]:{...cfg,...(state.tagOrders[tag]||{}),...patch}};
      persist();render();
    };
    const saveOrder=()=>update({enabled:true,order:$$('[data-order-id]',list).map(row=>row.dataset.orderId)});
    $('#tag-order-enable').onchange=e=>{update({enabled:e.target.checked});};
    $('#tag-order-page-size').onchange=e=>update({pageSize:Number(e.target.value)});
    if($('#tag-order-dates'))$('#tag-order-dates').onchange=e=>update({showDates:e.target.checked});
    list.addEventListener('click',e=>{
      const btn=e.target.closest('[data-move]'),row=btn?.closest('[data-order-id]');
      if(!row)return;
      const rows=$$('[data-order-id]',list),i=rows.indexOf(row),n=i+Number(btn.dataset.move);
      if(n<0||n>=rows.length)return;
      if(n<i)list.insertBefore(row,rows[n]);
      else list.insertBefore(row,rows[n].nextSibling);
      saveOrder();
      $('#tag-order-enable').checked=true;
    });
    let timer=0,row=null,startY=0,dragging=false;
    const reset=()=>{
      clearTimeout(timer);
      if(row)row.classList.remove('is-dragging');
      row=null;dragging=false;
    };
    list.addEventListener('pointerdown',e=>{
      const handle=e.target.closest('.tag-drag-handle'),target=handle?.closest('[data-order-id]');
      if(!target||e.button!==0||row)return;
      row=target;startY=e.clientY;
      try{list.setPointerCapture(e.pointerId);}catch(_){}
      timer=setTimeout(()=>{
        if(!row)return;
        dragging=true;row.classList.add('is-dragging');
        if(navigator.vibrate)navigator.vibrate(15);
      },330);
    });
    list.addEventListener('pointermove',e=>{
      if(!row)return;
      if(!dragging){
        if(Math.abs(e.clientY-startY)>12)reset();
        return;
      }
      e.preventDefault();
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-order-id]');
      if(target&&target!==row&&list.contains(target)){
        const r=target.getBoundingClientRect();
        if(e.clientY<r.top+r.height/2)list.insertBefore(row,target);
        else list.insertBefore(row,target.nextSibling);
      }
      const scroller=list.closest('.sheet-content');
      if(scroller){
        const r=scroller.getBoundingClientRect();
        if(e.clientY<r.top+36)scroller.scrollBy(0,-10);
        else if(e.clientY>r.bottom-36)scroller.scrollBy(0,10);
      }
    });
    const finish=()=>{
      const wasDragging=dragging;
      reset();
      if(wasDragging){saveOrder();$('#tag-order-enable').checked=true;toast('標籤排序已儲存');}
    };
    list.addEventListener('pointerup',finish);
    list.addEventListener('pointercancel',reset);
    list.addEventListener('lostpointercapture',()=>{if(dragging)finish();else reset();});
    list.addEventListener('contextmenu',e=>{if(e.target.closest('.tag-drag-handle'))e.preventDefault();});
  }
  function tagManager(){
    const content=`<div class="field"><label for="new-tag">新增分類名稱</label><div class="inline-actions"><input id="new-tag" class="text-input" maxlength="24" placeholder="例如：旅遊、商務、片語"><button id="tag-add" class="btn btn-primary" type="button">新增</button></div></div><div class="separator-label">目前分類</div>${state.tags.length?state.tags.map(t=>`<div class="tag-manage-row"><div><b>${esc(t)}</b> <small>· ${state.words.filter(w=>w.tags.includes(t)).length} 個單字${state.tagOrders?.[t]?.enabled?' · 自訂排序':''}</small></div><div class="tag-order-actions"><button class="tag-order-edit" type="button" data-order-tag="${esc(t)}">排序</button><button class="remove-mini" type="button" data-delete-tag="${esc(t)}">刪除</button></div></div>`).join(''):'<p class="empty-inline">沒有分類</p>'}<p class="field-note">刪除分類不會刪除單字。</p>`;
    openSheet('管理分類標籤',content,[{text:'完成',kind:'btn-primary',action:closeSheet}]);
    const add=()=>{const tag=clean($('#new-tag').value);if(!tag)return toast('請輸入分類');if(state.tags.some(t=>norm(t)===norm(tag)))return toast('這個分類已存在');state.tags.push(tag);persist();tagManager();toast('已新增分類');};
    $('#tag-add').onclick=add;$('#new-tag').onkeydown=e=>{if(e.key==='Enter')add();};
    $$('[data-order-tag]',$('#modal-layer')).forEach(b=>b.onclick=()=>tagOrderSheet(b.dataset.orderTag));
    $$('[data-delete-tag]',$('#modal-layer')).forEach(b=>b.onclick=()=>{const tag=b.dataset.deleteTag;if(!confirm(`刪除分類「${tag}」？單字仍會保留。`))return;state.tags=state.tags.filter(t=>t!==tag);for(const w of state.words)w.tags=w.tags.filter(t=>t!==tag);if(state.settings.tag===tag)state.settings.tag='';delete state.tagOrders[tag];persist();render();tagManager();});
  }
  function readCsv(raw){
    const text=String(raw||'').replace(/^\uFEFF/,'');
    const sample=text.split(/\r?\n/).slice(0,3).join('\n');
    const counts=[[',',(sample.match(/,/g)||[]).length],['\t',(sample.match(/\t/g)||[]).length],[';',(sample.match(/;/g)||[]).length]];
    const delimiter=counts.sort((a,b)=>b[1]-a[1])[0][0];
    const records=[];let row=[],field='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];
      if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else quoted=false;}else field+=c;}
      else if(c==='"')quoted=true;
      else if(c===delimiter){row.push(field);field='';}
      else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);field='';if(row.some(x=>clean(x)))records.push(row);row=[];}
      else field+=c;
    }
    row.push(field);if(row.some(x=>clean(x)))records.push(row);
    return records;
  }
  function parseGoogleCSV(text){
    const raw=readCsv(text),result=[];
    for(let i=0;i<raw.length;i++){
      const row=raw[i].map(clean);let en='',zh='',origin=null;
      if(row.length>=4 && /^(英文|中文|偵測語言|德文|法文|義大利文|西班牙文|en|English)/i.test(row[0])){
        const [from,to,src,dst]=row;
        if(from==='英文'&&src==='英文')continue;
        if(from.startsWith('中文')&&to==='英文'){en=dst;zh=toTraditionalZh(src,en);}
        else if(to==='英文'){en=src;zh='（中文待補）';}
        else{en=src;zh=toTraditionalZh(dst,en);}
        origin={from,to,originalSource:src,originalTarget:dst,row:i+1,category:'csv-import'};
      } else if(row.length>=2){
        if(i===0&&(/^(英文|english|word|source)$/i.test(row[0])||/^(中文|chinese|translation)$/i.test(row[1])))continue;
        en=row[0];zh=toTraditionalZh(row[1],en);origin={from:'英文',to:'中文',originalSource:en,originalTarget:zh,row:i+1,category:'csv-import'};
      }
      if(en && /[a-z]/i.test(en) && zh)result.push({en,zh,origin});
    }
    return result;
  }
  function mergeRows(incoming){
    const map=new Map(state.words.map(w=>[norm(w.en),w]));
    const removed=new Set(state.deletedKeys);
    let added=0,duplicate=0,variant=0,excluded=0;
    for(const r of incoming){
      const en=clean(r.en),zh=clean(r.zh),key=norm(en);
      if(!key){excluded++;continue;}
      let w=map.get(key);
      if(!w){
        if(removed.has(key)){excluded++;continue;}
        const now=timeNow();w=fixWord({id:uuid(),en,zh,note:clean(r.note||''),pos:r.pos||'',source:r.source||'新增 CSV 匯入',originals:r.origin?[r.origin]:[],createdAt:now,updatedAt:now});
        state.words.push(w);map.set(key,w);added++;
      }else{
        duplicate++;
        if(w.zh==='（中文待補）'&&hasHan(zh))w.zh=toTraditionalZh(zh,en);
        if(r.origin){const id=`${r.origin.from}|${r.origin.to}|${r.origin.originalSource}|${r.origin.originalTarget}`;
          if(!w.originals.some(x=>`${x.from}|${x.to}|${x.originalSource}|${x.originalTarget}`===id)){w.originals.push(r.origin);variant++;}}
      }
    }
    persist();currentPage=0;render();return {added,duplicate,variant,excluded};
  }
  function importCSVSheet(){
    const body=`<p class="plain-note">雲端版不會預先包含私人 Google 收藏。首次登入請先匯入舊版完整 JSON；日後新增的 Google 收藏 CSV 可再合併進來。已有單字與私人說明都不會被覆寫。</p><div class="import-card"><div class="card-title">選擇 Google 收藏 CSV</div><label class="file-picker">選擇 .csv 檔<input id="google-csv-file" type="file" accept=".csv,text/csv,text/plain"></label></div><p class="file-status" id="csv-result">不會刪除或清空目前單字本。</p>`;
    openSheet('合併 Google 收藏 CSV',body,[{text:'完成',kind:'btn-primary',action:closeSheet}]);
    $('#google-csv-file').onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      try{
        const parsed=parseGoogleCSV(await file.text());
        if(!parsed.length)throw new Error('沒有找到可匯入的單字');
        if(!confirm(`在檔案中找到 ${parsed.length} 筆紀錄。要將新單字與其他譯法合併到目前單字本嗎？`))return;
        const r=mergeRows(parsed);
        $('#csv-result').textContent=`已新增 ${r.added} 個單字；既有 ${r.duplicate} 筆，保存 ${r.variant} 個其他譯法。`;toast(`已新增 ${r.added} 個單字`);
      }catch(err){$('#csv-result').textContent=`匯入失敗：${err.message}`;}
    };
  }
  function mergeNotePack(notes,overwrite){
    const map=new Map(state.words.map(w=>[norm(w.en),w]));const removed=new Set(state.deletedKeys);
    let added=0,updated=0,skipped=0;
    for(const row of notes){
      const en=clean(row.en),note=clean(row.note),key=norm(en);if(!key||!note){skipped++;continue;}
      let w=map.get(key);
      if(!w){
        if(removed.has(key)||!clean(row.zh)){skipped++;continue;}
        const now=timeNow();w=fixWord({id:uuid(),en,zh:clean(row.zh),note,pos:row.pos||'',source:'AI 說明資料包',createdAt:now,updatedAt:now});
        state.words.push(w);map.set(key,w);added++;
      }else if(!clean(w.note)||overwrite){
        w.note=note;if(!w.pos && row.pos){w.pos=posString(row.pos);w.posSource='curated';}w.updatedAt=timeNow();updated++;
      }else skipped++;
    }
    persist();currentPage=0;render();return {added,updated,skipped};
  }
  function importNotesSheet(){
    const body=`<p class="plain-note">未來你把 AI 討論截圖交給我整理後，我會提供一個「說明資料包 .json」。這裡可直接匯入對應單字的說明，不需要重新下載整個 App。</p><div class="import-card"><div class="card-title">選擇 AI 說明資料包</div><label class="file-picker">選擇 .json 檔<input id="notes-file" type="file" accept=".json,application/json"></label></div><label class="note-merge-check"><input type="checkbox" id="overwrite-notes"> 用匯入內容覆蓋既有說明（預設保留你手動修改過的文字）</label><p class="file-status" id="notes-result">不會修改已有的中文翻譯。</p>`;
    openSheet('匯入 AI 說明資料包',body,[{text:'完成',kind:'btn-primary',action:closeSheet}]);
    $('#notes-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;
      try{
        const json=JSON.parse(await file.text());const notes=Array.isArray(json)?json:json.notes;
        if(!Array.isArray(notes)||notes.some(n=>typeof n?.en!=='string'||typeof n?.note!=='string'))throw new Error('內容不是 Wordbook 說明資料包');
        if(!confirm(`這份資料包有 ${notes.length} 筆說明。要合併進單字本嗎？`))return;
        const r=mergeNotePack(notes,$('#overwrite-notes').checked);
        $('#notes-result').textContent=`新增 ${r.added} 個單字、更新 ${r.updated} 個說明，略過 ${r.skipped} 筆（已有說明或缺少中文）。`;
        toast(`已處理 ${r.added+r.updated} 個說明`);
      }catch(err){$('#notes-result').textContent=`匯入失敗：${err.message}`;}
    };
  }
  function csvQuote(x){const s=String(x??'');return /[,"\n\r\t]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
  function downloadBlob(data,name,mime){const blob=data instanceof Blob?data:new Blob([data],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
  const dateStamp=()=>new Date().toISOString().slice(0,10);
  function exportJSON(){downloadBlob(JSON.stringify({...state,exportedAt:timeNow(),appName:'Wordbook Cloud v3'},null,2),`wordbook-complete-backup-${dateStamp()}.json`,'application/json;charset=utf-8');toast('已下載完整 JSON 備份');}
  function exportCSV(){
    const header=['英文','中文翻譯','說明','詞性','標籤','來源','Google原始收藏筆數','Google其他譯法','加入時間','詞性來源'];
    const rows=state.words.map(w=>[w.en,w.zh,w.note,w.pos,w.tags.join('; '),w.source,w.originals.length,w.originals.map(r=>`${r.from?.startsWith('中文')?toTraditionalZh(r.originalSource,w.en):r.originalSource} → ${r.to?.startsWith('中文')?toTraditionalZh(r.originalTarget,w.en):r.originalTarget} (${r.from}→${r.to})`).join(' | '),w.createdAt,w.posSource]);
    downloadBlob('\uFEFF'+[header,...rows].map(r=>r.map(csvQuote).join(',')).join('\r\n'),`wordbook-with-notes-${dateStamp()}.csv`,'text/csv;charset=utf-8');toast('已下載單字與說明 CSV');
  }
  function restoreSheet(){
    const body=`<p class="plain-note">從舊版 Wordbook 匯入你的完整 JSON 備份（包含實際保留的單字、中文、說明、詞性、標籤及刪除紀錄）。雲端尚無單字時請選「整本取代」；若已有資料則可選「合併」。</p>
      <div class="field"><label for="restore-mode">匯入方式</label><select class="select-input" id="restore-mode"><option value="merge" selected>合併備份（不刪除現有單字）</option><option value="replace">整本取代（首次匯入推薦；請確認已備份）</option></select></div>
      <div class="import-card"><div class="card-title">選擇 Wordbook JSON 備份</div><label class="file-picker">選擇 .json 檔<input id="backup-file" type="file" accept=".json,application/json"></label></div><p class="file-status" id="backup-result">此匯入會同步到私人資料庫，請確認備份完整。</p>`;
    openSheet('載入／合併舊版備份',body,[{text:'完成',kind:'btn-primary',action:closeSheet}]);
    $('#backup-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;
      try{
        const data=JSON.parse(await file.text());
        if(!Array.isArray(data?.words)||!Array.isArray(data?.tags))throw new Error('這不是 Wordbook 完整備份');
        if(data.words.some(w=>typeof w?.en!=='string'||typeof w?.zh!=='string'))throw new Error('備份單字格式錯誤');
        const mode=$('#restore-mode').value;
        if(mode==='merge'){
          if(!confirm(`要將備份中的 ${data.words.length} 個單字合併進目前的 ${state.words.length} 個單字嗎？已有詞條以你舊備份的中文為準，原本新加入的 AI 說明會保留。`))return;
          let added=0,merged=0;
          const map=new Map(state.words.map(w=>[norm(w.en),w]));
          for(const raw of data.words){
            const incoming=fixWord(raw),key=norm(incoming.en);if(!key)continue;
            const existing=map.get(key);
            if(!existing){incoming.id=uuid();state.words.push(incoming);map.set(key,incoming);added++;}
            else {
              // User-customized translation and category from old data have precedence;
              // keep the richer built-in AI explanation when old note is empty.
              existing.zh=toTraditionalZh(incoming.zh||existing.zh,existing.en);
              if(clean(incoming.note))existing.note=incoming.note;
              if(incoming.pos){existing.pos=posString(incoming.pos);existing.posDetails=incoming.posDetails||existing.posDetails;existing.posSource=incoming.posSource||'legacy';}
              existing.tags=[...new Set([...existing.tags,...incoming.tags])];
              if(incoming.originals.length){
                const set=new Set(existing.originals.map(r=>`${r.from}|${r.to}|${r.originalSource}|${r.originalTarget}`));
                for(const r of incoming.originals){const k=`${r.from}|${r.to}|${r.originalSource}|${r.originalTarget}`;if(!set.has(k)){existing.originals.push(r);set.add(k);}}
              }
              merged++;
            }
            state.deletedKeys=state.deletedKeys.filter(x=>x!==key);
          }
          // Preserve deletions from an older HTML download: newly seeded catalog
          // entries the user removed must not quietly return after merging a backup.
          const backupPresent=new Set(data.words.map(w=>norm(w.en)));
          const backupDeleted=new Set((Array.isArray(data.deletedKeys)?data.deletedKeys:[]).map(norm).filter(k=>k&&!backupPresent.has(k)));
          if(backupDeleted.size){
            state.deletedKeys=[...new Set([...state.deletedKeys,...backupDeleted])];
            state.words=state.words.filter(w=>!backupDeleted.has(norm(w.en)));
          }
          state.tags=[...new Set([...state.tags,...data.tags.map(String)])];
          state.tagOrders={...state.tagOrders,...normalizeTagOrders(data.tagOrders)};
          persist();currentPage=0;render();$('#backup-result').textContent=`合併完成：新增 ${added} 個單字，更新 ${merged} 個既有單字，保留 ${backupDeleted.size} 筆刪除紀錄；Google 收藏和說明保留。`;toast(`舊單字已合併：新增 ${added}、更新 ${merged}`);
        } else {
          if(!confirm(`確定用備份的 ${data.words.length} 個單字取代目前 ${state.words.length} 個單字？新匯入的 Google 收藏及說明會被移除。`))return;
          if(!confirm('再次確認：這是整本取代，請確認已備份目前 Wordbook。'))return;
          state={...blankState(),...data,version:2,words:data.words.map(fixWord),tags:[...new Set(data.tags.map(String))],tagOrders:normalizeTagOrders(data.tagOrders||state.tagOrders),settings:{sort:normalizeSort(data.settings?.sort),tag:String(data.settings?.tag||''),pos:POS_GROUPS.some(([key])=>key===data.settings?.pos)?data.settings.pos:'',search:''},appliedDatasets:[CAT.version],deletedKeys:Array.isArray(data.deletedKeys)?data.deletedKeys:[],translatorUrl:String(data.translatorUrl||state.translatorUrl||'')};
          currentPage=0;persist();closeSheet();render();toast(`已取代並還原 ${state.words.length} 個單字`);
        }
      }catch(err){$('#backup-result').textContent=`備份匯入失敗：${err.message}`;toast('備份內容無法匯入');}
    };
  }
  window.WordbookBridge=Object.freeze({
    getState:()=>JSON.parse(JSON.stringify(state)),
    isSheetOpen:()=>!$('#modal-layer').hidden,
    setState:(data)=>{
      stopPageSpeech();
      closeSheet();
      const raw=data&&typeof data==='object'?data:blankState();
      state={...blankState(),...raw,version:2,
        words:Array.isArray(raw.words)?raw.words.filter(w=>w&&typeof w.en==='string').map(fixWord):[],
        tags:Array.isArray(raw.tags)?[...new Set(raw.tags.map(String))]:[],
        tagOrders:normalizeTagOrders(raw.tagOrders),
        deletedKeys:Array.isArray(raw.deletedKeys)?raw.deletedKeys.map(norm):[],
        settings:{sort:normalizeSort(raw.settings?.sort),tag:String(raw.settings?.tag||''),pos:POS_GROUPS.some(([k])=>k===raw.settings?.pos)?raw.settings.pos:'',search:restorePageOnLogin?'':state.settings.search},
        translatorUrl:String(raw.translatorUrl||'')};
      if(restorePageOnLogin){currentPage=readStoredPage();searchOriginPage=null;highlightedWordId='';restorePageOnLogin=false;}
      // Background cloud refresh preserves the currently visible page.
      render();
    },
    notify:toast,
    hide:()=>{if(pageSpeech.active)stopPageSpeech();state=blankState();currentPage=0;searchOriginPage=null;highlightedWordId='';restorePageOnLogin=true;forgetPage();render();},
    setStatus:(message)=>{const el=$('#saved-status');if(el)el.textContent=message;},
    promptImport:()=>{restoreSheet();}
  });
  $('#read-page-btn').onclick=togglePageSpeech;
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&pageSpeech.active)stopPageSpeech();});
  window.addEventListener('pagehide',()=>{if(pageSpeech.active)stopPageSpeech();});
  $('#prev-btn').onclick=()=>setPage(currentPage-1);
  $('#next-btn').onclick=()=>setPage(currentPage+1);
  $('#page-jump-btn').onclick=pageJumpSheet;
  $('#add-btn').onclick=()=>wordEditor();
  $('#search-btn').onclick=searchSheet;
  $('#clear-search-btn').onclick=clearSearchAndRestore;
  $('#sort-btn').onclick=sortSheet;
  $('#more-btn').onclick=moreSheet;
  $('#word-list').onclick=e=>{const goto=e.target.closest('[data-goto-word]');if(goto){jumpToWordInBook(goto.dataset.gotoWord);return;}const item=e.target.closest('[data-word-id]');if(item)wordEditor(item.dataset.wordId);};
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#modal-layer').hidden){closeSheet();return;}if(!$('#modal-layer').hidden||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;if(e.key==='ArrowLeft')setPage(currentPage-1);if(e.key==='ArrowRight')setPage(currentPage+1);});
  const paper=$('#paper-page');
  paper.addEventListener('pointerdown',e=>{if(e.isPrimary)touchStart={x:e.clientX,y:e.clientY};});
  paper.addEventListener('pointerup',e=>{if(!touchStart||!e.isPrimary)return;const dx=e.clientX-touchStart.x,dy=e.clientY-touchStart.y;touchStart=null;if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.4)setPage(currentPage+(dx<0?1:-1));});
  paper.addEventListener('pointercancel',()=>{touchStart=null;});
  // Service worker is registered by cloud.js only after config validation.
  render();
  // Safe read-only QA surface for automated verification, no user-data export beyond this page.
  window.WordbookQA=Object.freeze({version:'2.1.9',toTraditionalZh,getCount:()=>state.words.length,rawGoogleCount:()=>state.words.reduce((s,w)=>s+w.originals.length,0),getWord:(en)=>{const w=state.words.find(x=>norm(x.en)===norm(en));return w?{en:w.en,zh:w.zh,note:w.note,pos:w.pos,posSource:w.posSource,originalCount:w.originals.length}:null;},parseGoogleCSV,parsePartOfSpeech:posItems,bulkPosSummary,sortValues:()=>sortedWords().slice(0,5).map(w=>w.en)});
})();
