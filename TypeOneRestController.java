package cris.prs.primes.rest;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.Serializable;
import java.net.URI;
//import java.net.http.HttpClient;
//import java.net.http.HttpRequest;
//import java.net.http.HttpRequest.BodyPublishers;
//import java.net.http.HttpResponse;
//import java.net.http.HttpResponse.BodyHandlers;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Calendar;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.StringJoiner;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.annotation.Resource;
import javax.annotation.security.PermitAll;
import javax.ejb.Stateless;
import javax.inject.Inject;
import javax.inject.Named;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.Session;
import javax.mail.Transport;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;
import javax.sql.DataSource;
import javax.transaction.Transactional;
import javax.ws.rs.Consumes;
import javax.ws.rs.GET;
import javax.ws.rs.POST;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.QueryParam;
import javax.ws.rs.core.Context;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.Response.ResponseBuilder;

import org.apache.commons.codec.binary.Base64;
import org.apache.log4j.Logger;
import org.json.JSONArray;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.http.converter.StringHttpMessageConverter;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.encoding.PasswordEncoder;
import org.springframework.security.authentication.encoding.ShaPasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParseException;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.itextpdf.text.Document;
import com.itextpdf.text.DocumentException;
import com.itextpdf.text.Element;
import com.itextpdf.text.Font;
import com.itextpdf.text.FontFactory;
import com.itextpdf.text.Paragraph;
import com.itextpdf.text.Phrase;
import com.itextpdf.text.pdf.PdfPCell;
import com.itextpdf.text.pdf.PdfPTable;
import com.itextpdf.text.pdf.PdfWriter;
import com.prs.mis.eDrishtiUtilities.EdrishtiUtilities;

import cris.prs.mis.common.StopWatch;
import cris.prs.mis.dao.feedback.FeedbackDao;
import cris.prs.mis.dao.feedback.IrepsDao;
import cris.prs.mis.dto.edrishti.EDrishtiInfo;
import cris.prs.mis.dto.feedback.IrepsDto;
import cris.prs.mis.graph.dto.PassengerSearchReportInfo;
import cris.prs.mis.graph.dto.TrainClassCoachWiseCateringReportInfo;
import cris.prs.mis.graph.dto.TrainClassWiseCateringReportInfo;
import cris.prs.mis.graph.report.GraphBaseReport;
import cris.prs.mis.icmsCoachAugmentRest.TainCoachAugPRSOutput;
import cris.prs.mis.report.ReportFactoryBookingLocation;
import cris.prs.mis.report.dto.bookinglocation.ReportResponse;
import cris.prs.mis.reportsanalytics.ReportsHistoryDao;
import cris.prs.mis.service.dto.ReportRequest;
import cris.prs.mis.utility.FileUploadAndEnvConfig;
import cris.prs.mis.validations.ValidateWebServiceParameters;
import cris.prs.primes.bean.HRMSRequestParameters;
import cris.prs.primes.bean.RequestParameters;
import cris.prs.primes.dao.ReportAccessLogging;
import cris.prs.primes.dao.ReportAccessRecordUtil;
import cris.prs.primes.factory.CoachForecastAvailabilityFactory;
import cris.prs.primes.factory.CoachForecastFactory;
import cris.prs.primes.factory.CustomerSegementationFactory;
import cris.prs.primes.factory.ExceptionFactory;
import cris.prs.primes.factory.HRMSValidationFactory;
import cris.prs.primes.factory.NatgridWsFactory;
import cris.prs.primes.factory.PrsDwDataLoadFactory;
import cris.prs.primes.factory.SaveRPFDataFiltersFactory;
import cris.prs.primes.factory.TypeOneMultiReportFactory;
import cris.prs.primes.factory.TypeOneReportFactory;
import cris.prs.primes.util.EncryptDecryptString;
//import cris.prs.primes.util.EncryptDecryptString;
import cris.prs.spring.dao.UserDAO;


@Stateless
@Named
@Path("/typeOne")
public class TypeOneRestController {

	private static final Logger log = Logger.getLogger(TypeOneRestController.class);

	@Resource(lookup = "java:jboss/datasources/sysbase3")
	private DataSource ds;
	@Resource(lookup = "java:/OracleDS/NgetOracleDS")
	private DataSource oDS;
	//@Resource(lookup = "java:/OracleDS/GUIDBAOracleDS")
	private DataSource guiDS;
	@Inject
	private ValidateWebServiceParameters validateObj;
	@Inject
	private EdrishtiUtilities eDrishtiutility;
	
	@Inject
	private ReportsHistoryDao reportsHistoryDao;
	
	@Inject
	private ReportFactoryBookingLocation reportFactoryBookingLocation;
	
	@Autowired
	private HttpServletRequest context;

	@GET
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/test")
	public ReportResponse getTest() {
		ReportResponse res = new ReportResponse();
		res.setFileName("TEST");
		return res;
	}
	
	@GET
	@Produces("application/pdf")
	@Path("/getPDF")
	public Response ReadPDF(@Context HttpServletRequest request) throws IOException {
		ReportResponse reportData1=null,reportData2=null,reportData3=null;
		Document document = new Document();
		String trainNo= request.getParameter("trainNo");
		String filename = "D:\\tmp\\test15.pdf";
		Pattern pattern =
		 Pattern.compile("[^A-Za-z0-9%&+,.:=_\\]");
		Matcher matcher = pattern.matcher(filename);
		if (matcher.find()) {
		 // Error
		}
		File file = new File(filename);
		PdfPCell hcell;		
		Font headFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD);
		  //File file = new File("/misac/primesdoc/RPFPurposeDocs/test.pdf");
		  //File file = new File("/home/jboss/dumps/test.pdf");
		  reportData1=eDrishtiutility.eDrishtiData1(trainNo);
		  ArrayList<?> columnList1 = reportData1.getColumnNames();
		  ArrayList<?> data1 = reportData1.getData(); 
		  reportData2=eDrishtiutility.eDrishtiData2(trainNo);
		  reportData3=eDrishtiutility.eDrishtiData3(trainNo);
//		  System.out.println("Deepesh1"+reportData1.getColumnNames());
//		  System.out.println("Deepesh1"+data1);
//		  System.out.println("Deepesh1"+data1);
		  PdfPTable table = new PdfPTable(columnList1.size());
	      try
	      {
	         PdfWriter writer = PdfWriter.getInstance(document, new FileOutputStream(file));
	         document.open();
	         document.add(new Paragraph("A Hello World PDF document."));
	         for (int i=0;i<columnList1.size();i++) {
	        	 hcell = new PdfPCell(new Phrase(String.valueOf(columnList1.get(i)), headFont));
	             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
	             table.addCell(hcell);
	         }	
	         for (int i=0;i<data1.size();i++) {
	        	 hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i)), headFont));
	             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
	             table.addCell(hcell);
	         }
	         document.add(table);
	         document.close();
	         writer.close();
	      } catch (DocumentException e)
	      {
	    	  log.error("fail");
	       //  e.printStackTrace();
	      } catch (FileNotFoundException e)
	      {
	    	  log.error("fail");
	        // e.printStackTrace();
	      }
	    ResponseBuilder response = Response.ok((Object) file);
	    response.type("application/pdf");
	    response.header("Content-Disposition",  "filename=restfile.pdf");
	    return response.build();	    	
	}

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getReport")
	public Map<String, Object> getReport(RequestParameters rps) {
		Map<String, Object> reportData = null;
		reportData = new TypeOneReportFactory(rps, ds).getData();
		return reportData;
	}

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@SuppressWarnings({ "unchecked" })
	@Path("/getCPGReport")
	public Map<String, Object> getCPGReport(RequestParameters rps) {
		Map<String, Object> reportData = null;
		reportData = new TypeOneReportFactory(rps, oDS).getData();
		return reportData;
	}

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getGUIDBAReport")
	public Map<String, Object> getGUIDBAReport(RequestParameters rps) {

		Map<String, Object> reportData = null;

		reportData = new TypeOneReportFactory(rps, guiDS).getData();
		if (rps.getReportCode().equals("GUIDBATRAINPROFILECHANGES2")) {
			rps.setReportCode("GUIDBATRAINPROFILECHANGES3");
			Map<String, Object> reportData2 = new TypeOneReportFactory(rps, guiDS).getData();
			reportData.put("sqt", reportData2);
		}

		return reportData;
	}

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getCFReport")
	public Map<String, Object> getCFReport(RequestParameters rps) {

		Map<String, Object> reportData = null;
		reportData = new CoachForecastFactory(rps, ds).getData();
		return reportData;
	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getRakeCoachAvailab")
	public Map<String, Object> getRakeCoachAvailab(RequestParameters rps) {

		Map<String, Object> reportData = null;
		reportData = new CoachForecastAvailabilityFactory(rps, ds).getData();
		return reportData;
	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getRakeComposition")
	public Map<String, Object> getRakeComposition(String rakeId) {
		
		final String uri = "http://10.60.200.171/icmsrptsrvc/train/SingleRakeLinkDetailPRS";
        RestTemplate restTemplate = new RestTemplate();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
        headers.set("authToken", "53662358eec748fc7cd1de7c6ce557a6");
        HashMap<String, String> requestPayload = new HashMap<>();
        rakeId = rakeId.replace("\"", "");
        requestPayload.put("idRakeLink", rakeId);
        HttpEntity<HashMap<String, String>> requestEntity = new HttpEntity<>(requestPayload, headers);

        ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.POST, requestEntity, String.class);
        String jsonResponse = response.getBody();

        // Parse JSON string into a Map
        JSONObject jsonObject = new JSONObject(jsonResponse);
        ObjectMapper objectMapper = new ObjectMapper();
        Map<String, Object> resultMap = null;
		try {
			resultMap = objectMapper.readValue(jsonObject.toString(), Map.class);
		} catch (JsonParseException e) {
			log.error("fail");//e.printStackTrace();
		} catch (JsonMappingException e) {
			log.error("fail");//e.printStackTrace();
		} catch (IOException e) {
			log.error("fail");//e.printStackTrace();
		}

//		Map<String, Object> reportData = null;
//		final String uri = "http://100.200.200.100/icmsrptsrvc/train/SingleRakeLinkDetailPRS";
//		@SuppressWarnings("unchecked")
//	    RestTemplate result = new RestTemplate();
//	    HttpHeaders headers = new HttpHeaders();
//		headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
//		headers.set("authToken", "53662358eec748fc7cd1de7c6ce557a6");
//        HashMap<String, String> map2= new HashMap<String, String>();
//		map2.put("idRakeLink","132652");
//		HttpEntity<HashMap<String, String>> requestEntity = new HttpEntity<HashMap<String, String>>(map2,headers);
//		
//        String jsonResponse = result.exchange(uri, HttpMethod.POST, requestEntity, String.class).getBody();
//        
//     // Parse the JSON string
//        JSONObject jsonObject = new JSONObject(jsonResponse);
//        
//        Map<String, Object> map = jsonObjectToMap(jsonObject);
//        
//        ObjectMapper objectMapper = new ObjectMapper();
//        try {
//            String jsonString = objectMapper.writeValueAsString(map);
//            System.out.println(jsonString);
//        } catch (Exception e) {
//            e.printStackTrace();
//        }
//        
////        Map<String, Object> data = new HashMap<>();
////        data.put("trainList", jsonObject.get("trainList").toString());
////        data.put("numberOfRakes", jsonObject.get("numberOfRakes").toString());
////        data.put("maxLoad", jsonObject.get("maxLoad").toString());
////        data.put("rakeLinkGauge", jsonObject.get("rakeLinkGauge").toString());
////        data.put("normalLoad", jsonObject.get("normalLoad").toString());
////        data.put("vSingleRakeConsist", jsonObject.get("vSingleRakeClassWiseCapacity"));
////        data.put("owningDivision",jsonObject.get("owningDivision").toString());
////        data.put("owningZone", jsonObject.get("owningZone").toString());
////        data.put("actLoad", jsonObject.get("actLoad").toString());
////        data.put("vSingleRakeClassWiseCapacity", jsonObject.get("vSingleRakeClassWiseCapacity"));
////        data.put("rakeLinkTrainType",jsonObject.get("rakeLinkTrainType").toString());
////        data.put("rakeType",jsonObject.get("rakeType").toString());
////        data.put("idRakeLink",jsonObject.get("idRakeLink").toString());
////        data.put("pmDepot", jsonObject.get("pmDepot").toString());
//
//        // Get the "vList" array
////        JSONArray jsonArray = jsonObject.getJSONArray("vList");
////        Set<String> columnNamesSet = new HashSet<>();
////        for (int i = 0; i < jsonArray.length(); i++) {
////            JSONObject jsonObject2 = jsonArray.getJSONObject(i);
////            Iterator<String> keys = jsonObject2.keys();
////            while (keys.hasNext()) {
////                columnNamesSet.add(keys.next());
////            }
////        }
////        
////        String[] columnNames = columnNamesSet.toArray(new String[0]);
////        
////        if (columnNames == null) {
////            columnNames = new String[0];
////        }
////        JSONArray jsonColumnNames = new JSONArray(columnNames);
////
////        // Extract data
////        List<List<Object>> dataList = new ArrayList<>();
////        for (int i = 0; i < jsonArray.length(); i++) {
////            JSONObject jsonObject2 = jsonArray.getJSONObject(i);
////            List<Object> row = new ArrayList<>();
////            for (String columnName : columnNames) {
////                row.add(jsonObject2.opt(columnName));
////            }
////            dataList.add(row);
////        }
////        
////        // Convert data list to JSONArray
////        JSONArray dataArray = new JSONArray(dataList);
//        
//        // Create the result map
////        Map<String, Object> resultMap = new HashMap<>();
////        resultMap.put("columnNames", jsonColumnNames);
////        resultMap.put("data", dataArray);
////        reportData=data;
////        ObjectMapper objectMapper = new ObjectMapper();
////        objectMapper.registerModule(new SimpleModule().addSerializer(JSONObject.class, new JSONObjectSerializer()));
////
////        try {
////            String jsonString = objectMapper.writeValueAsString(jsonObject);
////            System.out.println(jsonString);
////        } catch (Exception e) {
////            e.printStackTrace();
////        }
		return resultMap;
	}
	
	private static Map<String, Object> jsonObjectToMap(JSONObject jsonObject) {
        Map<String, Object> map = new HashMap<>();
        Iterator<String> keys = jsonObject.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = jsonObject.get(key);
            map.put(key, value);
        }
        return map;
    }

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getAOBData")
	public Map<String, Object> getAOBData(RequestParameters rps) {

		Map<String, Object> reportData = null;
		if (EncryptDecryptString.decrypt(rps.getEncUName()).equals("ADMINAOB")
				&& EncryptDecryptString.decrypt(rps.getEncPass()).equals("AOBPRS@PRIMES")) {
			reportData = new TypeOneReportFactory(rps, ds).getData();
		} else {
			reportData = new HashMap<String, Object>();
			reportData.put("message", "Invalid credential to access this REST API!");
		}
		return reportData;
	}

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getCSGraphData")
	public Map<String, Object> getCSGraphData(RequestParameters rps) {

		Map<String, Object> reportData = null;
		long sMillis = new Date().getTime();
		reportData = new CustomerSegementationFactory(rps, ds).getData();		
		long eMillis = new Date().getTime();
		ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);	
		double reportExeStartTime = 0;
		reportExeStartTime = StopWatch.Start();	
		ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
		return reportData;
	}

	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/saveRPFFilterParams")
	public Map<String, Object> saveRPFFilterParams(RequestParameters rps) {

		Map<String, Object> reportData = null;
		reportData = new SaveRPFDataFiltersFactory(rps, ds).getData();
		return reportData;
	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/check_for_barp_train")
	public JsonNode  check_for_barp_train (RequestParameters rps) throws JsonProcessingException, IOException{

		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String hostAddress = "http://dair.prs.op/PR001/check_forecast_barp_train";
		
		HashMap<String, String> map= new HashMap<String, String>();
		map.put("TRAIN_NO",params[0]);
		
		ObjectMapper objectMapper = new ObjectMapper();
		String requestJson = "["+objectMapper.writeValueAsString(map)+"]";
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
		HttpEntity<String> entity = new HttpEntity<String>(requestJson,headers);
		RestTemplate restTemplate = new RestTemplate();
		String response = restTemplate.postForObject(hostAddress, entity, String.class);
		JsonNode reportData=objectMapper.readTree(response);
		return reportData;		
	
	}
	
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/call_demandForecastIdealTrain")
	public JsonNode  call_demandForecastIdealTrain (RequestParameters rps) throws JsonProcessingException, IOException
	{
		
				
			String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
			final String uri;
			String requestUri;
	        String fromdate=params[1];
	        fromdate=fromdate.replace("'","");
			String todate=params[2];
			todate=todate.replace("'","");
			String trnno=params[3];
			trnno=trnno.replace("'","");
			String dayType=params[4];
			dayType=dayType.replace("'","");
			if(params[0].replace("'","").equals("historical")) {
				uri="http://10.64.28.95:80/showDemandHistorical";
			//uri="http://10.77.48.27:5000/showDemandHistorical";
			//	uri="http://10.64.8.164:5000/showDemandHistorical";
			}else {
				uri="http://10.64.28.95:80/showDemandPredicted";
//				uri="http://10.96.0.167:5000/showDemandPredicted";
//				uri="http://10.77.48.27:5000/showDemandPredicted";
	//			uri="http://10.64.8.164:5000/showDemandPredicted";
			}
			
//		    requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest=0&rm={rm}";
		    requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest={dayType}";
		    RestTemplate result = new RestTemplate();
            HashMap<String, String> map2= new HashMap<String, String>();
			map2.put("train_no", trnno);
			map2.put("from_date",fromdate);
			map2.put("to_date", todate);
			map2.put("dayType", dayType);
			long sMillis = new Date().getTime();
			double reportExeStartTime = 0;
			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
			long eMillis = new Date().getTime();
//			ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
			reportExeStartTime = StopWatch.Start();	
			ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
			ObjectMapper oMapper = new ObjectMapper();
			JsonNode reportData=oMapper.readTree(response.getBody());
			
			return reportData;		

	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/callIdealTrainClassWiseDemand")
	public JsonNode  callIdealTrainClassWiseDemand (RequestParameters rps) throws JsonProcessingException, IOException
	{
		
				
			String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
			final String uri;
			String requestUri;
			String trnno=params[1];
			trnno=trnno.replace("'","");
	        String fromdate=params[2];
	        fromdate=fromdate.replace("'","");
			String todate=params[3];
			todate=todate.replace("'","");
			String dayType=params[4];
			dayType=dayType.replace("'","");
			String stationList=params[5];
			stationList=stationList.replace("'","");
			String stationList2=params[6];
			stationList2=stationList2.replace("'","");
			StringJoiner joiner = new StringJoiner(","); 
			joiner.add(stationList); joiner.add(stationList2); 
			String newStationList = joiner.toString();
			
			if(params[0].replace("'","").equals("historical")) {
				uri="http://10.64.28.95:80/minSeatHistorical";
			//	uri="http://10.77.48.27:5000/minSeatHistorical";
			//	uri="http://10.64.8.164:5000/minSeatHistorical";
			}else {
				uri="http://10.64.28.95:80/minSeatPredicted";
//				uri="http://10.96.0.167:5000/minSeatPredicted";
//				uri="http://10.77.48.27:5000/minSeatPredicted";
		//		uri="http://10.64.8.164:5000/minSeatPredicted";
			}
			
			
		    requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest={dayType}&rm={rm}";
		    RestTemplate result = new RestTemplate();
            HashMap<String, String> map2= new HashMap<String, String>();
			map2.put("train_no", trnno);
			map2.put("from_date",fromdate);
			map2.put("to_date", todate);
			map2.put("dayType", dayType);
			map2.put("rm", newStationList);
			double reportExeStartTime = 0;
			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
			reportExeStartTime = StopWatch.Start();	
			ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
			ObjectMapper oMapper = new ObjectMapper();
			JsonNode reportData=oMapper.readTree(response.getBody());
			
			return reportData;		

	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/callIdealTrainRemoteWiseDemand")
	public JsonNode  callIdealTrainRemoteWiseDemand (RequestParameters rps) throws JsonProcessingException, IOException
	{
		
				
			String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
			final String uri;
			String requestUri;
			String trnno=params[1];
			trnno=trnno.replace("'","");
	        String fromdate=params[2];
	        fromdate=fromdate.replace("'","");
			String todate=params[3];
			todate=todate.replace("'","");
			String dayType=params[4];
			dayType=dayType.replace("'","");
			String stationList=params[5];
			stationList=stationList.replace("'","");
			String stationList2=params[6];
			stationList2=stationList2.replace("'","");
			StringJoiner joiner = new StringJoiner(","); 
			joiner.add(stationList); joiner.add(stationList2); 
			String newStationList = joiner.toString();
			
			if(params[0].replace("'","").equals("historical")) {
				uri="http://10.64.28.95:80/remoteWiseHistoricalDemand";
			//	uri="http://10.77.48.27:5000/remoteWiseHistoricalDemand";
		//		uri="http://10.64.8.164:5000/remoteWiseHistoricalDemand";
			}else {
				uri="http://10.64.28.95:80/remoteWisePredictedDemand";
//				uri="http://10.96.0.167:5000/remoteWisePredictedDemand";
//				uri="http://10.77.48.27:5000/remoteWisePredictedDemand";
	//		uri="http://10.64.8.164:5000/remoteWisePredictedDemand";
			}
			
		    requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest={dayType}&rm={rm}";
		    RestTemplate result = new RestTemplate();
            HashMap<String, String> map2= new HashMap<String, String>();
			map2.put("train_no", trnno);
			map2.put("from_date",fromdate);
			map2.put("to_date", todate);
			map2.put("dayType", dayType);
			map2.put("rm", newStationList);
			double reportExeStartTime = 0;
			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
			reportExeStartTime = StopWatch.Start();	
			ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
			ObjectMapper oMapper = new ObjectMapper();
			JsonNode reportData=oMapper.readTree(response.getBody());
			
			return reportData;		

	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/call_predict")
	public JsonNode  call_predict (RequestParameters rps) throws JsonProcessingException, IOException
	{
		
				
			String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
			final String uri;
			String requestUri;
	        String fromdate=params[1];
	        fromdate=fromdate.replace("'","");
			String todate=params[2];
			todate=todate.replace("'","");
			String trnno=params[3];
			trnno=trnno.replace("'","");
			String rem=params[4];
			rem=rem.replace("'","");
			//String reprtType=params[6];
			String stationList=params[5];
			stationList=stationList.replace("'","");
			String stationList2=params[6];
			stationList2=stationList2.replace("'","");
			String minNofSeats = params[7];
			String berthCapacity = params[8];
			berthCapacity=berthCapacity.replace("'","");
			String pooledQuotaPercentage = params[9];
			pooledQuotaPercentage=pooledQuotaPercentage.replace("'","");
			String tatkalQuotaPercentage = params[10];
			tatkalQuotaPercentage = tatkalQuotaPercentage.replace("'","");
			String premiumTatkalQuotaPercentage = params[11];
			premiumTatkalQuotaPercentage = premiumTatkalQuotaPercentage.replace("'","");
			String dayType=params[12];
			dayType=dayType.replace("'","");
			String model_selection = params[13];
			StringJoiner joiner = new StringJoiner(","); 
			joiner.add(stationList); joiner.add(stationList2); 
			String newStationList = joiner.toString();
			if(params[0].replace("'","").equals("historical")) {
//				uri="http://10.96.0.167:5000/quota";
				uri="http://10.64.28.95:80/quota";
			//	uri="http://10.77.48.27:5000/quota";
		//	uri="http://10.64.8.164:5000/quota";
			}else {
				uri="http://10.64.28.95:80/predictedquota";
//				uri="http://10.96.0.167:5000/predictedquota";
//				uri="http://10.77.48.27:5000/predictedquota";
		//		uri="http://10.64.8.164:5000/predictedquota";
			}
			
//		    requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest=0&rm={rm}";
			requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest={dayType}&rm={rm}&min_seats={minNoOfSeats}&berth_cap={berthCapacity}&pooled_percentage={pooledQuotaPercentage}&tatkal_percentage={tatkalQuotaPercentage}&premiumTatkalQuotaPercentage={premiumTatkalQuotaPercentage}&model={model_selection}";
//			RestTemplate result = new RestTemplate();
		  //timeout
			SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
		    rf.setReadTimeout(0);
		    rf.setConnectTimeout(0);
		    RestTemplate result = new RestTemplate(rf);
            HashMap<String, String> map2= new HashMap<String, String>();
			map2.put("train_no", trnno);
			map2.put("from_date",fromdate);
			map2.put("to_date", todate);
//			map2.put("cls",cls);
			map2.put("dayType", dayType);
			map2.put("rm", newStationList);
			map2.put("minNoOfSeats", minNofSeats);
			map2.put("berthCapacity",berthCapacity);
			map2.put("pooledQuotaPercentage",pooledQuotaPercentage);
			map2.put("tatkalQuotaPercentage",tatkalQuotaPercentage);
			map2.put("premiumTatkalQuotaPercentage",premiumTatkalQuotaPercentage);
			map2.put("model_selection", model_selection);
			long sMillis = new Date().getTime();
			double reportExeStartTime = 0;
			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
			long eMillis = new Date().getTime();
//			ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
			reportExeStartTime = StopWatch.Start();	
		/*
		 * System.out.println("anshul_log_quota"); Object[] getValuesWithAll =
		 * rps.getParams(); String paramValues = null; paramValues = "#"; int
		 * rPramasLength = rps.getParams().length; for (int i = 0; i < rPramasLength;
		 * i++) { if (getValuesWithAll[i] == null) getValuesWithAll[i] = "'NONE'"; else
		 * { String s = (String) getValuesWithAll[i];
		 * System.out.println("Report access log file"); System.out.println(s);
		 * System.out.println(paramValues); String snew=s.replaceAll(",", "");
		 * System.out.println(snew); getValuesWithAll[i]=snew; } paramValues =
		 * paramValues + getValuesWithAll[i] + "#"; }
		 */
			//System.out.println("paramValues");
			//System.out.println(paramValues);
			
			
			//System.out.println(rps.G);
			ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
			ObjectMapper oMapper = new ObjectMapper();
			JsonNode reportData=oMapper.readTree(response.getBody());
			
			return reportData;
		
		/*
		 * long sMillis = new Date().getTime(); ResponseEntity<String> response =
		 * result.getForEntity( requestUri,String.class,map ); long eMillis = new
		 * Date().getTime();
		 * ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
		 * ObjectMapper oMapper = new ObjectMapper(); JsonNode
		 * reportData=oMapper.readTree(response.getBody()); return reportData;
		 */

	}	
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/call_for_stationList")
	@Transactional(dontRollbackOn=TypeOneRestController.class)
	//@Transactional(value = 10, unit = TimeUnit.SECONDS).
	public JsonNode  call_for_stationList (RequestParameters rps) throws JsonProcessingException, IOException
	{
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		final String uri;
		String requestUri;
        String fromdate=params[1];
        fromdate=fromdate.replace("'","");
		String todate=params[2];
		todate=todate.replace("'","");
		String trnno=params[3];
		trnno=trnno.replace("'","");
//		String cls=params[3];
//		cls=cls.replace("'","");
		String rem=params[4];
		rem=rem.replace("'","");
		String dayType=params[5];
		dayType=dayType.replace("'","");
		String srcDistance = params[6];
		String destDistance = params[7];
		
		//String reprtType=params[6];
		if(params[0].replace("'","").equals("historical")) {
			uri = "http://10.64.28.95:80/stationList";
		//	uri = "http://10.77.48.27:5000/stationList";
		//    uri = "http://10.64.8.164:5000/stationList";
		}else {
			uri = "http://10.64.28.95:80/stationListPredicted";
//			uri = "http://10.96.0.167:5000/stationListPredicted";
//			uri = "http://10.77.48.27:5000/stationListPredicted";
		//	uri = "http://10.64.8.164:5000/stationListPredicted";
		}
			
//			requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&cls={cls}&fest={fest}&no_rem_loc={no_rem_loc}";
			requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest={dayType}&no_rem_loc={no_rem_loc}&src_distance={srcDistance}&dest_distance={destDistance}";
			SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
		    rf.setReadTimeout(0);
		    rf.setConnectTimeout(0);
			RestTemplate result = new RestTemplate(rf);
            HashMap<String, String> map= new HashMap<String, String>();
			map.put("train_no", trnno);
			map.put("from_date",fromdate);
			map.put("to_date", todate);
//			map.put("cls",cls);
			map.put("dayType", dayType);
			map.put("no_rem_loc", rem);
			map.put("srcDistance", srcDistance);
			map.put("destDistance", destDistance);
			
			long sMillis = new Date().getTime();
//			System.out.println("anshul_log_station");
//			System.out.println(rps);
//			System.out.println("--------anshul---------");
//	        System.out.println(rps.getParams().toString());
			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map );
			long eMillis = new Date().getTime();
			ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
			ObjectMapper oMapper = new ObjectMapper();
			JsonNode reportData=oMapper.readTree(response.getBody());
			
			return reportData;
	}
			
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/call_charting")
	public JsonNode  call_charting (RequestParameters rps) throws JsonProcessingException, IOException, ParseException
	{
		log.info("API call for call_charting received");
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String trnNo=params[0];
	           trnNo=trnNo.replace("'","");
	   	String trnStartDt=params[1];
		       trnStartDt=trnStartDt.replace("'","");	
		       
		       SimpleDateFormat inpformatter = new SimpleDateFormat("yyyy-MM-dd");
		       SimpleDateFormat opformatter = new SimpleDateFormat("dd-MM-yyyy");
		           Date date = inpformatter.parse(trnStartDt); 
		           trnStartDt = opformatter.format(date);       
        String inpRepChoice=params[2];
               inpRepChoice=inpRepChoice.replace("'","");				
		String stnCode;
		if (inpRepChoice.equals("all"))
		{
		        stnCode="";
		}
		else
		{
			        stnCode=params[3];
			        stnCode=stnCode.replace("'","");
		}			
//		final String uri = "http://primeschartdata.prod1.prs/isl-psgn/getList";
//		final String uri = "http://primeschartdata-stg.prs/isl-psgn/getList";
		final String uri = "https://primeschartdata.prs/isl-psgn/getList";
		String requestUri = uri + "?trainNumber={trainNumber}&trainDate={trainDate}&listType={listType}&station={station}";
		log.info("External API call URL is: "+requestUri);
		RestTemplate result = new RestTemplate();
        HashMap<String, String> map= new HashMap<String, String>();
		map.put("trainNumber", trnNo);
		map.put("trainDate", trnStartDt);
		map.put("listType", inpRepChoice);
		map.put("station", stnCode);
		long sMillis = new Date().getTime();
		log.info("Calling API NOW");
		ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map );
		long eMillis = new Date().getTime();
		ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
		ObjectMapper oMapper = new ObjectMapper();
		JsonNode reportData=oMapper.readTree(response.getBody());
		log.info("Response received.");
		return reportData;

	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/hht_charting")
	public JsonNode  hht_charting (RequestParameters rps) throws JsonProcessingException, IOException, ParseException
	{
		log.info("API call for hht_charting received");
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String trnNo=params[0];
	           trnNo=trnNo.replace("'","");
	   	String trnStartDt=params[1];
		       trnStartDt=trnStartDt.replace("'","");	
		       
//		       SimpleDateFormat inpformatter = new SimpleDateFormat("yyyy-MM-dd");
//		       SimpleDateFormat opformatter = new SimpleDateFormat("dd-MM-yyyy");
//		           Date date = inpformatter.parse(trnStartDt); 
//		           trnStartDt = opformatter.format(date);       
        String inpRepChoice=params[2];
               inpRepChoice=inpRepChoice.replace("'","");				
		String cls;
			cls=params[3];
			cls=cls.replace("'","");		
		final String uri = "http://10.77.32.73:9080/mfp/api/adapters/HHT_REPORT/passengerListTravellingOnASection";
		String requestUri = uri + "?params=[{trainNumber},{trainDate},{station},{class}]";
		log.info("External API call URL is: "+requestUri);
		RestTemplate result = new RestTemplate();
        HashMap<String, String> map= new HashMap<String, String>();
		map.put("trainNumber",'"'+ trnNo+'"');
		map.put("trainDate",'"'+ trnStartDt+'"');
		map.put("station", '"'+inpRepChoice+'"');
		map.put("class", '"'+cls+'"');
		long sMillis = new Date().getTime();
		log.info("Calling API NOW");
		ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map );
		long eMillis = new Date().getTime();
		ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
		ObjectMapper oMapper = new ObjectMapper();
		JsonNode reportData=oMapper.readTree(response.getBody());
		log.info("Response received.");
		return reportData;

	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_JSON })
	@Path("/call_chartingCaterData")
	public JsonNode  call_chartingCaterData (RequestParameters rps) throws JsonProcessingException, IOException, ParseException
	{
		log.info("API call for call_chartingCaterData received");
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String trnNo=params[0];
	           trnNo=trnNo.replace("'","");
	   	String trnStartDt=params[2];
		       trnStartDt=trnStartDt.replace("'","");	
		       
		       SimpleDateFormat inpformatter = new SimpleDateFormat("yyyy-MM-dd");
		       SimpleDateFormat opformatter = new SimpleDateFormat("dd-MM-yyyy");
		           Date date = inpformatter.parse(trnStartDt); 
		           trnStartDt = opformatter.format(date);    			
		String stnCode;
		
			        stnCode=params[1];
			        stnCode=stnCode.replace("'","");
					
		//http://primeschartdata.dev1.prs/isl-psgn/getCateringList?trainNumber=22691&trainDate=20-08-2023
		//http://primeschartdata.prod1.prs/isl-psgn/getCateringList?trainNumber=22692&trainDate=20-11-2023&station=NZM
//        final String uri = "http://primeschartdata.prod1.prs/isl-psgn/getCateringList";
//        final String uri = "http://primeschartdata-stg.prs/isl-psgn/getCateringList";
        final String uri = "https://primeschartdata.prs/isl-psgn/getCateringList";
		String requestUri = uri + "?trainNumber={trainNumber}&trainDate={trainDate}&station={station}";
		log.info("External API call URL is: "+requestUri);
		RestTemplate result = new RestTemplate();
        HashMap<String, String> map= new HashMap<String, String>();
		map.put("trainNumber", trnNo.trim());
		map.put("trainDate", trnStartDt);
		map.put("station", stnCode);
		long sMillis = new Date().getTime();
		log.info("Calling ChartingCaterData API NOW");
		ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map );
		long eMillis = new Date().getTime();
		ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
		ObjectMapper oMapper = new ObjectMapper();
		JsonNode reportData=oMapper.readTree(response.getBody());
		log.info("Response received.");
		return reportData;

	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getIrctcCateringDetails")
	public Map<String, Object> getIrctcCateringDetails(RequestParameters rps,@Context HttpServletRequest request) {
		String[] whiteListIPs = {"202.93.154.124","202.93.154.253","10.64.8.76","10.64.8.77",
					"10.64.8.83","10.64.8.84","10.64.8.89"};
		boolean validIp = false;
		final String x_Forwarded_For = request.getHeader("X-Forwarded-For");
		String ip = null;
		if(x_Forwarded_For==null){	    						
			ip = request.getRemoteAddr();
		}else{
			if(x_Forwarded_For.indexOf(",")>0){
				String addresses[] = x_Forwarded_For.split(",");
				ip = addresses[0].trim();
			}else{
				ip = x_Forwarded_For.trim();
			}
		}
				
		for (String element : whiteListIPs) { 
            if (element.equals(ip)) { 
                validIp = true;
            } 
        } 		
		
		Map<String, Object> reportData = new HashMap<String, Object>();
		if(!validIp) {
			log.info("IRCTC Catering Web Service: Request received from unrecognized host "+ ip);
			reportData.put("message", "Request received from unrecognized host");
			return reportData;
		}
		log.info("IRCTC Catering Web Service: Request received from recognized host "+ ip);
		rps.setReportCode("IRCTCCATERINGDETAILSWS");
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		for(int i=0; i < params.length ; i++) {
			params[i] = params[i].replace("'", "");
		}
		if(rps.getUserName() == null || rps.getPassword() == null) {
			reportData.put("message", "Provide valid credentials to access this REST API!");
		}else if(!validateCredentials(rps.getUserName(), rps.getPassword())) {//!(rps.getUserName().equals("irctcweb") && rps.getPassword().equals("web@20_dw"))) {
			reportData.put("message", "Invalid credential to access this REST API!");
		}else if(params.length !=2 ) {
			reportData.put("message", "Invalid parameters. This service accepts 2 parameters only");			
		}else if(!validateObj.validateParameters(new ArrayList<String>(Arrays.asList("irctc_train_no")),
				new ArrayList<String>(Arrays.asList(params[1])))) {
			reportData.put("message", validateObj.getMessage());			
		}else {
			SimpleDateFormat dateParamFormat = new SimpleDateFormat("yyyy-MM-dd");
			Date inputDate;
			try {
				inputDate = dateParamFormat.parse(params[0]);
				if(!validateObj.validateInputDate(inputDate)) {
					reportData.put("message", validateObj.getMessage());
				}
			}catch (ParseException e) {
				reportData.put("message", "Invalid parameters. Date format is not valid");
			}	
		}						
		if(!reportData.containsKey("message")){
			reportData = new TypeOneReportFactory(rps, ds).getData(); 
		}
		return reportData;
	}
	
	boolean validateCredentials(String username, String password) {
		RequestParameters rps= new RequestParameters();
		rps.setReportCode("IRCTCUSERS");
		rps.setParams(null);
		ArrayList<Map<String,String>> data = new NatgridWsFactory(rps, ds).getData();
		PasswordEncoder encoder = (PasswordEncoder) new ShaPasswordEncoder(256);
		String pswordenc= encoder.encodePassword(password, "");
		for(int i=0;i<data.size();i++) {
			if(data.get(i).get("username").trim().equals(username) && data.get(i).get("password").equals(pswordenc)) {
				return true;
			}
		}
		return false;
	}

/*ArrayList<String> islTrainProfile()
{
	InputStream json = null;
	JsonNode arrNode = null;
	try {
		arrNode = new ObjectMapper().readTree(json).get("objects");
	} catch (IOException e) {
		// TODO Auto-generated catch block
		e.printStackTrace();
	}
	if (arrNode.isArray()) {
	    for (final JsonNode objNode : arrNode) {
	        System.out.println(objNode);
	    }
	}
	return null;

}*/
	ArrayList<ArrayList<String>> islTrainProile(JsonNode reportData) throws JsonProcessingException, IOException
	{
		ObjectMapper mapper = new ObjectMapper();
		JsonNode rootNode = reportData;
		
		ArrayList<ArrayList<String>> result=new ArrayList<ArrayList<String>> ();
		ArrayList x= mapper.convertValue(rootNode.get("matrix_actual"), ArrayList.class);
		ArrayList y = mapper.convertValue(rootNode.get("matrix_optimize"), ArrayList.class);
		ArrayList z = mapper.convertValue(rootNode.get("pattern"), ArrayList.class);
		result.add(x); 
		result.add(y);
		result.add(z);
		 for (int i = 0; i < result.size(); i++) { 
	            for (int j = 0; j < result.get(i).size(); j++) { 
	                System.out.print(result.get(i).get(j) + " "); 
	            } 
//	            System.out.println(); 
	        } 
	    
		return result;
	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/prsDwDataCheckTextFiles")
	public Map<String, Object> prsDwDataCheckTextFiles(RequestParameters rps) {
		final String HOST = "10.96.0.166";
		final String USER = "prsiqmnt";
		final String PASS = "prsiqmnt123";
		Map<String, Object> fileData = new HashMap<String,Object>();
		String[] columnNames = {"File Name","Last Modified Date","Last Modified Time","File Size (in bytes)", "Site"};
		ArrayList<Object[]> data = new ArrayList<>();
		
		String inputDate = rps.getParams()[0].toString();
		String inputSite = (rps.getParams()[1] == null)? null: rps.getParams()[1].toString();
		String dateMonth = inputDate.substring(8, 10)+inputDate.substring(5, 7);
		String year = inputDate.substring(2, 4);	
		String pattern = "DW[a-zA-Z0-9_]*"+dateMonth+"[0-9]*"+year+".TXT[a-zA-Z0-9_.]*";
		String[] sites = {"ndls","bmb","cal","mas"};
		
		FileUploadAndEnvConfig sftpChannel = new FileUploadAndEnvConfig(HOST, USER, PASS);
		for(int i=0; i<sites.length; i++) {
			if(inputSite == null || inputSite.equals(sites[i])) {
				data.addAll(sftpChannel.listFilesWithPattern("dwprs/"+sites[i],pattern));
			}
		}
		
		fileData.put("data", data);
		fileData.put("columnNames", columnNames);	
		return fileData;
	}
	
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/prsDwDataLoad")
	public Map<String, Object> prsDwDataLoad(RequestParameters rps) {
		Map<String, Object> reportData = null;
		reportData = new PrsDwDataLoadFactory(rps, ds).getData();
		return reportData;
	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getUserList")
	public Map<String, Object> getUserList(RequestParameters rps) {
		String username = new String();
		Authentication auth = SecurityContextHolder.getContext().getAuthentication();
		if (!(auth instanceof AnonymousAuthenticationToken)) {
			UserDetails userDetail = (UserDetails) auth.getPrincipal();
			username = userDetail.getUsername().trim();
		}
//		System.out.println(username);
		Object[] params = new Object[1];
		Object obj = "'"+username+"'";
		params[0] = obj;
		rps.setParams(params);
		Map<String, Object> reportData = null;
		reportData = new TypeOneReportFactory(rps, ds).getData();
		return reportData;
	}
	

	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/listForecastBarpTrains")
	public JsonNode  listForecastBarpTrains() throws JsonProcessingException, IOException{
		String hostAddress = "http://dair.prs.op/PR001/list_forecast_barp_trains";		
		ObjectMapper objectMapper = new ObjectMapper();
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
		HttpEntity<String> entity = new HttpEntity<String>(null,headers);
		RestTemplate restTemplate = new RestTemplate();
		String response = restTemplate.postForObject(hostAddress, entity, String.class);
		JsonNode reportData=objectMapper.readTree(response);
		return reportData;			
	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/callDemandForecastTrain")
	public JsonNode  callDemandForecastTrain(RequestParameters rps) throws JsonProcessingException, IOException{
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String hostAddress = "http://dair.prs.op/PR001/get_demand_barp_by_train";
		HashMap<String, String> map= new HashMap<String, String>();
		map.put("TRAIN_NO",params[0]);
		map.put("DATE",params[1]);
		//body
		ObjectMapper objectMapper = new ObjectMapper();
		String requestJson = "["+objectMapper.writeValueAsString(map)+"]";
		//headers
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
		//request header and body
		HttpEntity<String> entity = new HttpEntity<String>(requestJson,headers);
		//timeout
		SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
	    rf.setReadTimeout(0);
	    rf.setConnectTimeout(0);
	    RestTemplate restTemplate = new RestTemplate(rf);
	    //rest call
		String response = restTemplate.postForObject(hostAddress, entity, String.class);
		JsonNode reportData=objectMapper.readTree(response);
		return reportData;		
	}
	
	@POST
    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/callDemandForecastTrainClassOdPair")
	public JsonNode  callDemandForecastTrainClassOdPair(RequestParameters rps) throws JsonProcessingException, IOException{
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String hostAddress = "http://dair.prs.op/PR001/";
		switch(params[6]){
			case "daily": 
				hostAddress += "get_demand_barp";
				break;
			case "weekly": 
				hostAddress +=  "get_demand_by_week";
				break;
			case "weekday": 
				hostAddress +=  "get_demand_by_dayofweek";
				break;
		}
		HashMap<String, String> map= new HashMap<String, String>();
		map.put("TRAIN_NO",params[0]);
		map.put("DATE",params[1]);
		map.put("CLASS", params[3]);
		map.put("STN_FROM", params[4]);
		map.put("STN_UPTO", params[5]);	
		ObjectMapper objectMapper = new ObjectMapper();
		String requestJson = "["+objectMapper.writeValueAsString(map)+"]";
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
		HttpEntity<String> entity = new HttpEntity<String>(requestJson,headers);
		RestTemplate restTemplate = new RestTemplate();
		String response = restTemplate.postForObject(hostAddress, entity, String.class);
		JsonNode reportData=objectMapper.readTree(response);
		return reportData;		
	}
	
	
	@POST
    @Produces({ MediaType.TEXT_PLAIN })
    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/callGenerateForecastModel")
	public String  callGenerateForecastModel(RequestParameters rps) throws JsonProcessingException, IOException{
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		String hostAddress = "http://dair.prs.tr/PR001/generate_barp_models_by_train";
		HashMap<String, String> map= new HashMap<String, String>();
		map.put("TRAIN_NO",params[0]);
		ObjectMapper objectMapper = new ObjectMapper();
		String requestJson = "["+objectMapper.writeValueAsString(map)+"]";
		HttpHeaders headers = new HttpHeaders();
		headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
		HttpEntity<String> entity = new HttpEntity<String>(requestJson,headers);
		RestTemplate restTemplate = new RestTemplate();
		String response = restTemplate.postForObject(hostAddress, entity, String.class);
		return response;		
	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/getMultiReport")
	public Map<String, Object> getMultiReport(RequestParameters rps) {
		Map<String, Object> reportData = null;
		reportData = new TypeOneMultiReportFactory(rps, ds).getData();
		return reportData;
	}
	
//	@POST
//    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
//    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
//	@Path("/meriSaheli")
//	public JsonNode  meriSaheli (RequestParameters rps) throws JsonProcessingException, IOException, ParseException
//	{
//		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
//		String trnNo=params[0];
//	           trnNo=trnNo.replace("'","");
//	   	String trnStartDt=params[1];
//		       trnStartDt=trnStartDt.replace("'","");	
//		       
//		       SimpleDateFormat inpformatter = new SimpleDateFormat("yyyy-MM-dd");
//		       SimpleDateFormat opformatter = new SimpleDateFormat("dd-MM-yyyy");
//		           Date date = inpformatter.parse(trnStartDt); 
//		           trnStartDt = opformatter.format(date);       
//		         //final String uri = "http://primeschartdata-dev.apos.io/isl-psgn/getLadyList";
//		 final String uri = "http://primeschartdata.apos.net/isl-psgn/getLadyList";
//		String requestUri = uri + "?trainNumber={trainNumber}&trainDate={trainDate}";
//			RestTemplate result = new RestTemplate();
//            HashMap<String, String> map= new HashMap<String, String>();
//			map.put("trainNumber", trnNo);
//			map.put("trainDate", trnStartDt);
//			long sMillis = new Date().getTime();
//			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map );
//			long eMillis = new Date().getTime();
//			ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
//			ObjectMapper oMapper = new ObjectMapper();
//			JsonNode reportData=oMapper.readTree(response.getBody());
//			return reportData;
//
//	}
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/insertItpData")
	public JsonNode  insertItpData(RequestParameters rps) throws JsonProcessingException, IOException, InstantiationException, IllegalAccessException, ClassNotFoundException, SQLException{
//		System.out.println("insertItpData_anshul_hit");
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		final String uri;
		String requestUri;
		uri="http://10.64.28.95:80/insertData";
		//uri="http://10.64.8.164:5000/insertData";
		//uri="http://10.77.48.27:5000/insertData";
		
				//requestUri = uri + "?profile_id={profile_id}&opt_data={opt_data}";
				//requestUri = uri + "?profile_id={profile_id}&int_data={int_data}&opt_data={opt_data}";
				requestUri = uri + "?train_number={trainNUmber}&current_date={current_date}&version_number={version_number}&userid_itp={userid_itp}&berth_count_itp={berth_count_itp}&remote_count={remote_count}&str_remote={str_remote}&int_data={int_data}&opt_data={opt_data}";
//		System.out.println("insertItpData_anshul");
//				System.out.println(requestUri);
				String trainNUmber=params[0];
				trainNUmber=trainNUmber.replace("'","");
				String current_date=params[1];
				current_date = current_date.replace("'","");
				String version_number=params[2];
				version_number=version_number.replace("'","");
				String userid_itp=params[3];
				userid_itp = userid_itp.replace("'","");
				String berth_count_itp=params[4];
				berth_count_itp = berth_count_itp.replace("'","");
				String remote_count=params[5];
				remote_count = remote_count.replace("'","");
				String str_remote=params[6];
				str_remote = str_remote.replace("'","");
				String int_data=params[7];
				int_data = int_data.replace("'","");
				String opt_data=params[8];
				opt_data = opt_data.replace("'","");
				
				
				
				 RestTemplate result = new RestTemplate();
			     HashMap<String, String> map2= new HashMap<String, String>();
					map2.put("trainNUmber", trainNUmber);
					map2.put("current_date", current_date);
					map2.put("version_number", version_number);
					map2.put("userid_itp", userid_itp);
					map2.put("berth_count_itp", berth_count_itp);
					map2.put("remote_count", remote_count);
					map2.put("str_remote", str_remote);
					map2.put("int_data",int_data);
					map2.put("opt_data",opt_data);
					double reportExeStartTime = 0;
					ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
					reportExeStartTime = StopWatch.Start();	
					ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
					ObjectMapper oMapper = new ObjectMapper();
					JsonNode reportData=oMapper.readTree(response.getBody());
					return reportData;
			}
			
				
	
	@POST
	@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
	@Path("/insertItpDataMid")
	public int  insertItpDataMid(RequestParameters rps) throws JsonProcessingException, IOException, InstantiationException, IllegalAccessException, ClassNotFoundException, SQLException{
//		System.out.println("insertItpData_anshul_hit");
		String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
		final String uri;
		String requestUri;
		uri="http://10.64.28.95:80/insertDataMid";
		//uri="http://10.96.0.167:5000/insertDataMid";
		//uri="http://10.64.8.164:5000/insertDataMid";
		//uri="http://10.77.48.27:5000/insertData";
		
				//requestUri = uri + "?profile_id={profile_id}&opt_data={opt_data}";
				//requestUri = uri + "?profile_id={profile_id}&int_data={int_data}&opt_data={opt_data}";
				requestUri = uri + "?train_number={trainNUmber}&ProfileId={ProfileId}&from_date={from_date}&profile_data={profile_data}&approval_flag={approval_flag}&Complete_flag={Complete_flag}&save_flag={save_flag}";
//		System.out.println("insertItpData_anshul");
//				System.out.println(requestUri);
				String trainNUmber=params[0];
				trainNUmber=trainNUmber.replace("'","");
				String ProfileId=params[1];
				ProfileId = ProfileId.replace("'","");
				String from_date=params[2];
				from_date=from_date.replace("'","");
				String profile_data=params[3];
				profile_data = profile_data.replace("'","");
				String approval_flag=params[4];
				approval_flag = approval_flag.replace("'","");
				String Complete_flag=params[5];
				Complete_flag = Complete_flag.replace("'","");
				String save_flag = params[6];
				save_flag = save_flag.replace("'","");
		/*
		 * String str_remote=params[6]; str_remote = str_remote.replace("'",""); String
		 * int_data=params[7]; int_data = int_data.replace("'",""); String
		 * opt_data=params[8]; opt_data = opt_data.replace("'","");
		 */
				
				try (Connection connection = ds.getConnection()) {
		            String storedProcedure = "{CALL PRSDA.AN_ITP_TRAIN_PROFILE_PROC(?, ?, ?, ?, ?, ?, ?)}";
		            String[] temp = ProfileId.split("-");
		            String trnno = temp[0];
		            int seq_number = Integer.parseInt(temp[1]);
		            try (PreparedStatement callableStatement1 = connection.prepareStatement(storedProcedure)) {
		                callableStatement1.setString(1, trainNUmber);
		                callableStatement1.setString(2, ProfileId);
		                callableStatement1.setString(3, from_date);
		                callableStatement1.setString(4, profile_data);
		                callableStatement1.setString(5, approval_flag);
		                callableStatement1.setString(6, Complete_flag);
		                callableStatement1.setString(7, save_flag);

		                callableStatement1.execute();
		               
		                
		                String storedProcedure2 = "{CALL PRSDA.InsertTrainProfileID(?, ?)}";
		                
		                try (PreparedStatement callableStatement2 = connection.prepareCall(storedProcedure2)) {
		                    callableStatement2.setString(1, trnno);
		                    callableStatement2.setInt(2, seq_number);

		                    callableStatement2.execute();

		                    // You can return any result or status code here
		                    

		                    // You can handle the results from both procedures here if needed

		                    return 1; // Assuming 1 represents success
		                }
		                
		                // You can return any result or status code here
		                // Assuming 1 represents success
		            }
		        } catch (SQLException e) {
		            log.error("Error while executing the stored procedure: " + e.getMessage(), e);
		            return -1; // Handle exceptions as needed
		        }	
				
				
				
				
		//old code start		
				
				
	//			 RestTemplate result = new RestTemplate();
	//		     HashMap<String, String> map2= new HashMap<String, String>();
	//				map2.put("trainNUmber", trainNUmber);
	//				map2.put("ProfileId", ProfileId);
	//				map2.put("from_date", from_date);
	//				map2.put("profile_data", profile_data);
	//				map2.put("approval_flag", approval_flag);
	//				map2.put("Complete_flag", Complete_flag);
	//				map2.put("save_flag", save_flag);
		/*
		 * map2.put("str_remote", str_remote); map2.put("int_data",int_data);
		 * map2.put("opt_data",opt_data);
		 */
	//				double reportExeStartTime = 0;
	//				ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
	//				reportExeStartTime = StopWatch.Start();	
	//				ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
	//				ObjectMapper oMapper = new ObjectMapper();
	//				JsonNode reportData=oMapper.readTree(response.getBody());
	//				return reportData;
			}
	
	
	
	
	
	

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/insertItpDataApprover")
			public JsonNode  insertItpDataApprover(RequestParameters rps) throws JsonProcessingException, IOException, InstantiationException, IllegalAccessException, ClassNotFoundException, SQLException{
				String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
				final String uri;
				String requestUri;
				uri="http://10.64.28.95:80/insertDataApprove";
				requestUri = uri + "?profile_id={profile_id}&opt_data={opt_data}";requestUri = uri + "?profile_id={profile_id}&opt_data={opt_data}";
		String profile_id=params[0];
		profile_id=profile_id.replace("'","");
		String opt_data=params[1];
		opt_data=opt_data.replace("'","");
		
		 RestTemplate result = new RestTemplate();
	     HashMap<String, String> map2= new HashMap<String, String>();
			map2.put("profile_id", profile_id);
			map2.put("opt_data",opt_data);
			double reportExeStartTime = 0;
			ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map2 );
			reportExeStartTime = StopWatch.Start();	
			ReportAccessLogging.registerReportAccess(rps,StopWatch.elapsedTime(reportExeStartTime));
			ObjectMapper oMapper = new ObjectMapper();
			JsonNode reportData=oMapper.readTree(response.getBody());
			return reportData;
	}
			
			
			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getBogieMaster")
			public JsonNode getBogieMaster() throws JsonProcessingException, IOException, InstantiationException, IllegalAccessException, ClassNotFoundException, SQLException{
				final String uri;
				String requestUri;
				String hostAddress ="http://10.64.28.95:80/getCoachProfile";
				//String hostAddress ="http://10.64.8.164:5000/getCoachProfile";		
				ObjectMapper objectMapper = new ObjectMapper();
				HttpHeaders headers = new HttpHeaders();
				headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
				HttpEntity<String> entity = new HttpEntity<String>(null,headers);
				RestTemplate restTemplate = new RestTemplate();
				String response = restTemplate.postForObject(hostAddress, entity, String.class);
				JsonNode reportData=objectMapper.readTree(response);
				return reportData;	
				
			}
			
			
			
			
			
			
			
			
			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainBogie")
			public JsonNode getTrainBogie() throws JsonProcessingException, IOException, InstantiationException, IllegalAccessException, ClassNotFoundException, SQLException{
				final String uri;
				String requestUri;
				String hostAddress ="http://10.64.8.164:5000/getTrainCoachProfile";	
				//String hostAddress ="http://10.64.8.164:5000/getTrainCoachProfile";	
				ObjectMapper objectMapper = new ObjectMapper();
				HttpHeaders headers = new HttpHeaders();
				headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
				HttpEntity<String> entity = new HttpEntity<String>(null,headers);
				RestTemplate restTemplate = new RestTemplate();
				String response = restTemplate.postForObject(hostAddress, entity, String.class);
				JsonNode reportData=objectMapper.readTree(response);
				return reportData;		
				
			}
			
			@POST
		    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
		    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/call_for_train_composition")
			@Transactional(dontRollbackOn=TypeOneRestController.class)
			public JsonNode call_for_train_composition(RequestParameters rps) throws JsonProcessingException, IOException
			{
				String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
				final String uri;
				String requestUri;
		        String trn=params[0];
		        trn=trn.replace("'","");
		        //uri = "http://10.64.8.164:5000/getTrainCoachProfile";
		        uri = "http://10.64.28.95:80/getTrainCoachProfile";
				//requestUri = uri + "?train_no={train_no}&from_date={from_date}&to_date={to_date}&fest={dayType}&no_rem_loc={no_rem_loc}";
					requestUri = uri + "?train_number={train_no}";
					SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
				    rf.setReadTimeout(0);
				    rf.setConnectTimeout(0);
					RestTemplate result = new RestTemplate(rf);
		            HashMap<String, String> map= new HashMap<String, String>();
					map.put("train_no", trn);
					long sMillis = new Date().getTime();
					ResponseEntity<String> response =  result.getForEntity( requestUri,String.class,map );
					long eMillis = new Date().getTime();
					ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
					ObjectMapper oMapper = new ObjectMapper();
					JsonNode reportData=oMapper.readTree(response.getBody());	
					return reportData;
			}
			
			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path(value = "/PRIMESrating")
			public Map<String, Object> PRIMESrating(RequestParameters rps,@Context HttpServletRequest request) {
				HttpSession session = request.getSession();
				UserDAO userDAO= new UserDAO();
				String userName =(String) session.getAttribute("userName");
				if (userDAO.getRatingFlag(userName)==2) {
				Map<String, Object> reportData = new HashMap();
				Map<String, String> map2 = new HashMap();
				map2.put("Error", "You have already rated us. We appreciate it.");
				reportData = new TypeOneReportFactory(rps, ds).getData();
				reportData.put("Msg",map2);
				return reportData;}
				else {
				Map<String, Object> reportData = null;
				String a=String.valueOf(rps.getParams()[0]);
				log.info(a);
 				String b=String.valueOf(rps.getParams()[1]);
				String c=String.valueOf(rps.getParams()[2]);
				String d=String.valueOf(rps.getParams()[3]);
				String e=String.valueOf(rps.getParams()[4]);
				String f=String.valueOf(rps.getParams()[5]);
			    FeedbackDao feedbackDao= new FeedbackDao();
				boolean status= feedbackDao.updatePRIMESrating(a,b,c,d,e,f, ds);
				boolean status1=feedbackDao.updatePRIMESratingFlag(b,ds);
				reportData = new TypeOneReportFactory(rps, ds).getData();
				return reportData;}
			}
			
			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@SuppressWarnings({ "unchecked" })
			@Path("/stockSearch")
			public ReportResponse stockSearch(ReportRequest reportRequest) {

				ReportResponse response = new ReportResponse();

				GraphBaseReport report = null;

					report = reportFactoryBookingLocation.getStockSearchDAO(ds);
					report.executeReport(ds, reportRequest.getDataFilter());
					response.setData((ArrayList<TrainClassCoachWiseCateringReportInfo>) report.getReportData());
					response.setTotal((TrainClassCoachWiseCateringReportInfo) report.getTotal());
				
				response.setColumnNames(report.getColumnNames());
				response.setHeader(report.getHeader());

				return response;

			}

			@POST
			@Produces("application/pdf")
			@Path("/getIREPSPDF")
			public Response getIREPSPDF(@Context HttpServletRequest request) throws IOException {

				String HOST = "10.96.0.167";
				String USER = "misftp";
				String PASS = "misftp123";
				SimpleDateFormat format1 = new SimpleDateFormat("dd-MMM-yyyy");  
				SimpleDateFormat format2 = new SimpleDateFormat("HH:mm");
				SimpleDateFormat format3 = new SimpleDateFormat("ddMMyy");
				Date date= new Date();
				ArrayList<IrepsDto> reportData1 = new ArrayList<IrepsDto>();
				IrepsDao irepsDao=new IrepsDao(ds);
				Document document = new Document();
				String filename = "PRS_PREPAID_CATERING_REPPORT_"+format3.format(date)+".pdf";
				String filename1 = "E:/tmp/PRS_PREPAID_CATERING_REPPORT_"+format3.format(date)+".pdf";
				Pattern pattern = Pattern.compile("[^A-Za-z0-9%&+,.:=_]");
				Matcher matcher = pattern.matcher(filename);
				if (matcher.find()) {
				}
				File file = new File(filename);
				File fileDisp=new File(filename1);
				PdfPCell hcell;		
				Font headFont = FontFactory.getFont(FontFactory.HELVETICA_BOLD,9);
				Font headFont1 = FontFactory.getFont(FontFactory.TIMES_BOLD);
				Font headFont3 = FontFactory.getFont(FontFactory.defaultEncoding, 9);
				Font headFont2 = FontFactory.getFont(FontFactory.defaultEncoding, 8);
				  reportData1=irepsDao.getIrepsReport();
				  ArrayList<?> columnList1 = irepsDao.ColumnNames();
				  ArrayList<IrepsDto> data1 = reportData1;
				  boolean status=false;
				    try {
			        	ByteArrayOutputStream baos = new ByteArrayOutputStream();
				  PdfPTable table = new PdfPTable(columnList1.size());
			      try
			      {
			         PdfWriter writer = PdfWriter.getInstance(document, new FileOutputStream(file));
			         PdfWriter writer1 = PdfWriter.getInstance(document, new FileOutputStream(fileDisp));
			         document.open();
			         
			         document.add(new Paragraph("Static Report of Pre-paid Catering Charges of PRS for Train Start Date: ",headFont1));
			         document.add(new Paragraph("\n"));
			         for (int i=0;i<columnList1.size();i++) {
			        	 hcell = new PdfPCell(new Phrase(String.valueOf(columnList1.get(i)), headFont));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			         }	
			         for (int i=0;i<data1.size();i++)  {
			        	 hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getTrainStartDate()),headFont2));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getTrainSourceZone()),headFont3));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getTrainNo()),headFont3));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getCateringAmount()),headFont3));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getPercentage()),headFont3));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getCateringPer()),headFont3));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getLoadTime()),headFont2));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			             hcell = new PdfPCell(new Phrase(String.valueOf(data1.get(i).getTrainName()),headFont3));
			             hcell.setHorizontalAlignment(Element.ALIGN_CENTER);
			             table.addCell(hcell);
			        	 
			         }
			         document.add(table);
			         document.add(new Paragraph("\n Report Generation time: "+format1.format(date)+" "+format2.format(date),headFont1));
			         document.close();
			         writer.close();
			         writer1.close();
			      } catch (DocumentException e)
			      {
			    	  log.error("fail");
			      } catch (FileNotFoundException e)
			      {
			    	  log.error("fail");
			      }
			    ResponseBuilder response = Response.ok((Object) file);
			    response.type("application/pdf");
			    response.header("Content-Disposition",  "filename=restfile.pdf");
			    response.build();
					 FileInputStream is = new FileInputStream(file);//new ByteArrayInputStream(baos.toByteArray());
					 FileUploadAndEnvConfig sftpUploader = new FileUploadAndEnvConfig(HOST, USER, PASS);				 
			         status= sftpUploader.uploadFile(is, filename, "/misac/prs_catering_data");
			         sftpUploader.disconnect();
					 is.close();
					 if(status) {
						 log.info("File has been generated");
					 }else {
						 log.info("Failed");
					 }
				} catch (IOException e1) {						
					log.error("fail");//e1.printStackTrace();
				} 
				    ResponseBuilder response1 = Response.ok((Object) fileDisp);
				    response1.type("application/pdf");
				    response1.header("Content-Disposition",  "filename=restfile.pdf");
			    
			    return response1.build();	    	
			}
			
			@POST
		    @Produces({ MediaType.TEXT_PLAIN })
		    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/hrmsUserValidationOtp")
			public String  hrmsUserValidationOtp(HRMSRequestParameters hrmsrps,@Context HttpServletRequest request) throws JsonProcessingException, IOException{
				final String x_Forwarded_For = request.getHeader("X-Forwarded-For");
				String ip = null;
				if(x_Forwarded_For==null){	    						
					ip = request.getRemoteAddr();
				}else{
					if(x_Forwarded_For.indexOf(",")>0){
						String addresses[] = x_Forwarded_For.split(",");
						ip = addresses[0].trim();
					}else{
						ip = x_Forwarded_For.trim();
					}
				}
//				final String uri = "http://10.77.48.16:8080/hrmssinglesignon/api-for-singlesignon";
				final String uri = "http://10.77.32.41:8080/hrmssinglesignon/api-for-singlesignon";
				@SuppressWarnings("unchecked")
			    RestTemplate result = new RestTemplate();
			    HttpHeaders headers = new HttpHeaders();
				headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
				headers.add("Authorization", "Basic " + getBasicAuthHeader());
	            HashMap<String, String> map2= new HashMap<String, String>();
				map2.put("activity","login/mapping");
				map2.put("hrmsid",hrmsrps.getHrmsId());
//				map2.put("password","OTIwMmZiYzMyNWE0Nzc0Zjk1MjFmN2I2ZjFjN2QxMTk6OjNjMmU3ZjFmODc0YjUyNzY0NTIyNTBjODIxOWIwNGI3OjpZckY1V0F2dFhRc3JkWjhzSGpYWldBPT0=");
				map2.put("password",hrmsrps.getHrmsPassword());
				map2.put("ipaddress",ip);
				map2.put("otpsend",hrmsrps.getHrmsOtpAvbl());
				map2.put("otp","");
				HttpEntity<HashMap<String, String>> requestEntity = new HttpEntity<HashMap<String, String>>(map2,headers);
				
				ResponseEntity<String> response = result.exchange(uri,HttpMethod.POST,requestEntity,String.class);
				
				String res =  response.getBody();
				ObjectMapper oMapper = new ObjectMapper();
				JsonNode reportData=oMapper.readTree(res);
				Integer status = Integer.parseInt(reportData.get("status").asText());
				HttpSession session = request.getSession();
				String userName =(String) session.getAttribute("userName");
//				if (status==1)
//				{
//					int updateStatus = new HRMSValidationFactory(hrmsrps.getHrmsId(),userName, ds).getData();
//				}
				return reportData.get("message").asText();		
			}
			
			@POST
		    @Produces({ MediaType.TEXT_PLAIN })
		    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/hrmsUserValidation")
			public String  hrmsUserValidation(HRMSRequestParameters hrmsrps,@Context HttpServletRequest request) throws JsonProcessingException, IOException{
				final String x_Forwarded_For = request.getHeader("X-Forwarded-For");
				String ip = null;
				if(x_Forwarded_For==null){	    						
					ip = request.getRemoteAddr();
				}else{
					if(x_Forwarded_For.indexOf(",")>0){
						String addresses[] = x_Forwarded_For.split(",");
						ip = addresses[0].trim();
					}else{
						ip = x_Forwarded_For.trim();
					}
				}
				final String uri = "http://10.77.32.41:8080/hrmssinglesignon/api-for-singlesignon";
				@SuppressWarnings("unchecked")
			    RestTemplate result = new RestTemplate();
			    HttpHeaders headers = new HttpHeaders();
				headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
				headers.add("Authorization", "Basic " + getBasicAuthHeader());
	            HashMap<String, String> map2= new HashMap<String, String>();
				map2.put("activity","login/mapping");
				map2.put("hrmsid",hrmsrps.getHrmsId());
//				map2.put("password","OTIwMmZiYzMyNWE0Nzc0Zjk1MjFmN2I2ZjFjN2QxMTk6OjNjMmU3ZjFmODc0YjUyNzY0NTIyNTBjODIxOWIwNGI3OjpZckY1V0F2dFhRc3JkWjhzSGpYWldBPT0=");
				map2.put("password",hrmsrps.getHrmsPassword());
				map2.put("ipaddress",ip);
				map2.put("otpsend",hrmsrps.getHrmsOtpAvbl());
				map2.put("otp",hrmsrps.getHrmsOtp());
				HttpEntity<HashMap<String, String>> requestEntity = new HttpEntity<HashMap<String, String>>(map2,headers);
				
				ResponseEntity<String> response = result.exchange(uri,HttpMethod.POST,requestEntity,String.class);
				
				String res =  response.getBody();
				ObjectMapper oMapper = new ObjectMapper();
				JsonNode reportData=oMapper.readTree(res);
				Integer status = Integer.parseInt(reportData.get("status").asText());
				HttpSession session = request.getSession();
				String userName =(String) session.getAttribute("userName");
//				int updateStatus = new HRMSValidationFactory("ETSRIQ","AKSHAY88A", ds).getData();
				if (status==1)
				{
					int updateStatus = new HRMSValidationFactory(hrmsrps.getHrmsId(),userName, ds).getData();
				}
				return reportData.get("message").asText();		
			}
			
			private static String getBasicAuthHeader() {
//		        String credentials = "ssohrms:ssohrms@2022";
				UserDAO userDAO = new UserDAO();
				HashMap<String, String> authDetails = userDAO.getBasicAuthDetails();
				String credentials = authDetails.get("userName")+":"+authDetails.get("userPassword");
//		        String credentials = "test_ssoprs:ssohrms@2022";
		        return new String(Base64.encodeBase64(credentials.getBytes()));
		    }
			
			// Helper method to create vSingleRakeConsist list
		    private List<Map<String, Object>> createRakeConsistList() {
		        List<Map<String, Object>> list = new ArrayList<>();
		        
		        // Add items to the list
		        list.add(createRakeConsistItem(1, "LWLRRM", "LPR", 0, 0, null, "WR", 1));
		        list.add(createRakeConsistItem(2, "LVPH", "VP", 0, 0, null, "WR", 1));
		        // ... add other items similarly
		        list.add(createRakeConsistItem(22, "LWLRRM", "LPR", 0, 0, null, "WR", 1));
		        
		        return list;
		    }

		    // Helper method to create a single rake consist item
		    private Map<String, Object> createRakeConsistItem(int sr, String coachType, String coachClass, int totalPassengerCapacity, int firstPrsCapacity, String firstPRSClass, String owningRly, int compositClassFlag) {
		        Map<String, Object> item = new HashMap<>();
		        item.put("sr", sr);
		        item.put("coachType", coachType);
		        item.put("coachClass", coachClass);
		        item.put("totalPassengerCapacity", totalPassengerCapacity);
		        item.put("firstPrsCapacity", firstPrsCapacity);
		        item.put("firstPRSClass", firstPRSClass);
		        item.put("owningRly", owningRly);
		        item.put("compositClassFlag", compositClassFlag);
		        return item;
		    }

		    // Helper method to create vSingleRakeClassWiseCapacity list
		    private List<Map<String, Object>> createRakeClassWiseCapacityList(Object obj) {
		        List<Map<String, Object>> list = new ArrayList<>();
		        list.add(createCapacityItem("1A", 24));
		        list.add(createCapacityItem("2A", 260));
		        list.add(createCapacityItem("3A", 864));
		        list.add(createCapacityItem("LPR", 0));
		        list.add(createCapacityItem("PC", 0));
		        list.add(createCapacityItem("VP", 0));
		        return list;
		    }

		    // Helper method to create a single capacity item
		    private Map<String, Object> createCapacityItem(String coachClass, int capacity) {
		        Map<String, Object> item = new HashMap<>();
		        item.put("coachClass", coachClass);
		        item.put("capacity", capacity);
		        return item;
		    }
		    
		    static class JSONObjectSerializer extends JsonSerializer<JSONObject> {
		        @Override
		        public void serialize(JSONObject jsonObject, JsonGenerator gen, SerializerProvider serializers) throws IOException {
		            gen.writeRawValue(jsonObject.toString());
		        }
		    }
		   
		    @POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/icmsData")
			public int icmsData(RequestParameters rps) throws ParseException{
				
//				final String uri = "https://icms.indainrail.gov.in/traindemand/RaiseTrainDemand";
				final String uri="http://10.60.200.171/traindemand/RaiseTrainDemand";
				int rs=0;
		        RestTemplate restTemplate = new RestTemplate();
		        HttpHeaders headers = new HttpHeaders();
		        headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
		        headers.set("authToken", "53662358eec748fc7cd1de7c6ce557a6");
		        Object[] data=rps.getParams();
//		        System.out.println("ICMS data0: "+ data[0].toString());
		        for(int x=0;x<data.length;x++) {
		        	String[] storeData=data[x].toString().replace("[","").replace("]","").split(",");
		        	SimpleDateFormat inpformatter = new SimpleDateFormat("yyyy-MM-dd");
		        	SimpleDateFormat formatter = new SimpleDateFormat("dd-MMM-yyyy");
		        	String sentStatus="N";
		        HashMap<String, String> map2= new HashMap<String, String>();
				map2.put("demandID",storeData[0]);
				map2.put("arpFromDate",formatter.format(inpformatter.parse(storeData[3].trim())));
				map2.put("arpToDate",formatter.format(inpformatter.parse(storeData[4].trim())));
				map2.put("srcStation",storeData[5].trim());
				map2.put("srcZone",storeData[6].trim());
				map2.put("dstnStation",storeData[7].trim());
				map2.put("dstnZone",storeData[8].trim());
				map2.put("numberOfTrips",storeData[9].trim());
				map2.put("festivalType",storeData[2].trim());
				map2.put("freqTypeFlag",storeData[1].trim());
				HttpEntity<HashMap<String, String>> requestEntity = new HttpEntity<HashMap<String, String>>(map2,headers);
//				System.out.println("ICMS requestEntity: "+ requestEntity + " URL: "+ uri);
				try {
		        ResponseEntity<String> response = restTemplate.exchange(uri, HttpMethod.POST, requestEntity, String.class);
//		        System.out.println("ICMS Response Recieved: "+ response.getBody());
		        String jsonResponse = response.getBody();
		        if(jsonResponse.split(",")[0].split(":")[1].equalsIgnoreCase("\"Y\"") && jsonResponse.split(",")[1].split(":")[1].equalsIgnoreCase("\"Y\"")) {
		        		sentStatus="Y";
		        	}
				}catch( Exception e ) {
				log.error("ICMS Error:"+e);
				}
		        
		        
		        String query="Insert into PRSDBA.ICMS_PROPOSED_DATA(Demand_ID,Freq,Festival,TOD_from_Date,TOD_To_Date,Source_Station,Source_Station_Zone,Destination_Station,Destination_Station_Zone,New_Trips_required,SENT_FLAG,loading_Time)"
	        			+ " values('"+storeData[0].trim()+"','"+storeData[1].trim()+"','"+storeData[2].trim()+"','"+storeData[3].trim()+"','"+
	        			storeData[4].trim()+"','"+storeData[5].trim()+"','"+storeData[6].trim()+"','"+storeData[7].trim()+"','"
    					+ storeData[8].trim()+"','"+storeData[9].trim()+"','"+sentStatus+"',getdate())";
//		        System.out.println("ICMS Query: "+ " values('"+storeData[0].trim()+"','"+storeData[1].trim()+"','"+storeData[2].trim()+"','"+storeData[3].trim()+"','"+
//	        			storeData[4].trim()+"','"+storeData[5].trim()+"','"+storeData[6].trim()+"','"+storeData[7].trim()+"','"+storeData[8].trim()+"','"+storeData[8].trim()+"','"+sentStatus+",getdate()')");
		        rs=rs+executeInsertQuery(query,ds,x);
		        ObjectMapper objectMapper = new ObjectMapper();
		        Map<String, Object> resultMap = null;
		        
	        }
				return rs;
			}
		    
		    private static int executeInsertQuery(String query,DataSource ds,int count) {
				Connection con = null;
				PreparedStatement pstmt=null;
				int rs = 0;
				try {
//						log.info(query);
						ds.setLoginTimeout(500000);
						con = ds.getConnection();
						pstmt = con.prepareStatement(query);
//						System.out.println("Rows Inserted"+count);
//						System.out.println("Query"+query);
						return pstmt.executeUpdate();
				} catch (Exception e) {
					log.error(e.getMessage(), e);
				}finally {
					try {
						if (pstmt != null)
							pstmt.close();
						if (con != null)
							con.close();
					} catch (Exception exx) {
						log.info(exx.getMessage(),exx);
					}
				}
				return rs;
			}

			@POST
		    @Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
		    @Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getChartingOfTrain")
			public JsonNode  getChartingOfTrain (RequestParameters rps) throws Exception, JsonProcessingException, IOException, ParseException
			{
				log.info("API call for call_charting received");
				String[] params = Arrays.copyOf(rps.getParams(), rps.getParams().length,String[].class) ;
				String zone=params[0];
				zone=zone.replace("'","");
				String fromdate=params[1];
		        fromdate=fromdate.replace("'","");
				String todate=params[2];
				todate=todate.replace("'","");
	        	SimpleDateFormat inpformatter = new SimpleDateFormat("yyyy-MM-dd");
	        	SimpleDateFormat opformatter = new SimpleDateFormat("dd-MM-yyyy");
//				Date from = opformatter.parse(fromdate); 
//		        Date to = opformatter.parse(todate); 
	        	Date date3 = inpformatter.parse(fromdate);
	        	fromdate = opformatter.format(date3);
	        	Date date4 = inpformatter.parse(todate);
	        	todate = opformatter.format(date4);
				final String uri = "https://primeschartdata.prs/chart/getChartPreparedZonewise";
				RestTemplate result = new RestTemplate();
			    HttpHeaders headers = new HttpHeaders();
				headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
				headers.set("Accept","application/json");
		        HashMap<String, String> obj= new HashMap<String, String>();
		        obj.put("zoneCode", zone);
				obj.put("dateFrom", fromdate);
				obj.put("dateUpto", todate);
				HttpEntity<HashMap<String, String>> requestEntity = new HttpEntity<HashMap<String, String>>(obj,headers);
				ResponseEntity<String> response =  result.exchange(uri,HttpMethod.POST,requestEntity,String.class);
				long sMillis = new Date().getTime();
				log.info("External API call URL is: "+obj);
				log.info("Calling API NOW");
				long eMillis = new Date().getTime();
				ReportAccessRecordUtil.updateAccessRecord(rps,sMillis,eMillis,ds);
				ObjectMapper oMapper = new ObjectMapper();
				JsonNode reportData=oMapper.readTree(response.getBody());
				log.info("Response received.");
				return reportData;

			}
//Rashi--Train profile optimization APIs added 

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainList")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainList(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    String[] params = Arrays.copyOf(
			            rps.getParams(),
			            rps.getParams().length,
			            String[].class
			    );
			    String curDate = params[0];


			    String requestUri =
			            "http://10.64.28.95:80/TPO/train/list/"
			            + "?cur_date={cur_date}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();

			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);

			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map =
			            new HashMap<String, String>();

			    map.put("cur_date", curDate);

			    ResponseEntity<String> response =
			            result.getForEntity(
			                    requestUri,
			                    String.class,
			                    map
			            );

			    ObjectMapper oMapper = new ObjectMapper();

			    JsonNode reportData =
			            oMapper.readTree(response.getBody());



			    return reportData;
			}

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainDetails")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainDetails(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    String[] params = Arrays.copyOf(
			            rps.getParams(),
			            rps.getParams().length,
			            String[].class
			    );

			    String num = params[0];
			    String siteId = params[1];
			    String curDate = params[2];

			    final String uri;

			    uri = "http://10.64.28.95:80/TPO/train/details/{num}";

			    String requestUri;

			    requestUri = uri
			            + "?site_id={site_id}"
			            + "&cur_date={cur_date}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();

			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);

			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map =
			            new HashMap<String, String>();

			    map.put("num", num);
			    map.put("site_id", siteId);
			    map.put("cur_date", curDate);

			    long sMillis = new Date().getTime();

			    ResponseEntity<String> response =
			            result.getForEntity(
			                    requestUri,
			                    String.class,
			                    map
			            );

			    long eMillis = new Date().getTime();

			    ObjectMapper oMapper = new ObjectMapper();

			    JsonNode reportData =
			            oMapper.readTree(response.getBody());

			    return reportData;
			}


			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainProfileData")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainProfileData(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    String[] params = Arrays.copyOf(
			            rps.getParams(),
			            rps.getParams().length,
			            String[].class
			    );

			    String num = params[0];
			    String siteId = params[1];
			    String curDate = params[2];

			    final String uri;

			    uri = "http://10.64.28.95:80/TPO/train/profile/{num}";

			    String requestUri;

			    requestUri = uri
			            + "?site_id={site_id}"
			            + "&cur_date={cur_date}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();

			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);

			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map =
			            new HashMap<String, String>();

			    map.put("num", num);
			    map.put("site_id", siteId);
			    map.put("cur_date", curDate);

			    long sMillis = new Date().getTime();

			    ResponseEntity<String> response =
			            result.getForEntity(
			                    requestUri,
			                    String.class,
			                    map
			            );

			    long eMillis = new Date().getTime();

			    ObjectMapper oMapper = new ObjectMapper();

			    JsonNode reportData =
			            oMapper.readTree(response.getBody());

			    return reportData;
			}

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainUtilization")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainUtilization(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    String[] params = Arrays.copyOf(
			            rps.getParams(),
			            rps.getParams().length,
			            String[].class
			    );

			    String num = params[0];
			    String siteId = params[1];
			    String profileDate = params[2];
			    String startDate = params[3];
			    String endDate = params[4];

			    final String uri;

			    uri = "http://10.64.28.95:80/TPO/train/utilization/{num}";

			    String requestUri;

			    requestUri = uri
			            + "?site_id={site_id}"
			            + "&profile_date={profile_date}"
			            + "&start_date={start_date}"
			            + "&end_date={end_date}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();

			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);

			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map =
			            new HashMap<String, String>();

			    map.put("num", num);
			    map.put("site_id", siteId);
			    map.put("profile_date", profileDate);
			    map.put("start_date", startDate);
			    map.put("end_date", endDate);

			    long sMillis = new Date().getTime();

			    ResponseEntity<String> response =
			            result.getForEntity(
			                    requestUri,
			                    String.class,
			                    map
			            );

			    long eMillis = new Date().getTime();

			    ObjectMapper oMapper = new ObjectMapper();

			    JsonNode reportData =
			            oMapper.readTree(response.getBody());

			    return reportData;
			}
			// Fetch train Demand
			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainDemand")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainDemand(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    String[] params = Arrays.copyOf(
			            rps.getParams(),
			            rps.getParams().length,
			            String[].class
			    );

			    String num = params[0];
			    String siteId = params[1];
			    String startDate = params[2];
			    String endDate = params[3];

			    final String uri;

			    uri = "http://10.64.28.95:80/TPO/train/demand/{num}";

			    String requestUri;

			    requestUri = uri
			            + "?site_id={site_id}"
			            + "&start_date={start_date}"
			            + "&end_date={end_date}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();

			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);

			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map =
			            new HashMap<String, String>();

			    map.put("num", num);
			    map.put("site_id", siteId);
			    map.put("start_date", startDate);
			    map.put("end_date", endDate);

			    long sMillis = new Date().getTime();

			    ResponseEntity<String> response =
			            result.getForEntity(
			                    requestUri,
			                    String.class,
			                    map
			            );

			    long eMillis = new Date().getTime();

			    ObjectMapper oMapper = new ObjectMapper();

			    JsonNode reportData =
			            oMapper.readTree(response.getBody());

			    return reportData;
			}

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainOptimization")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainOptimization(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    String[] params = Arrays.copyOf(
			            rps.getParams(),
			            rps.getParams().length,
			            String[].class
			    );

			    String num = params[0];
			    String siteId = params[1];
			    String profileDate = params[2];
			    String fromDate = params[3];
			    String toDate = params[4];

			    String uri =
			            "http://10.64.28.95:80/TPO/train/train/optimize/{num}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();

//			    rf.setReadTimeout(30000);
//			    rf.setConnectTimeout(30000);

			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> uriParams =
			            new HashMap<String, String>();

			    uriParams.put("num", num);

			    Map<String, Object> body =
			            new HashMap<String, Object>();

			    body.put("site_id", siteId);
			    body.put("profile_date", profileDate);
			    body.put("start_date", fromDate);
			    body.put("end_date", toDate);

			    if (rps.getEdited_berths() != null &&
			            !rps.getEdited_berths().isEmpty()) {

			        body.put(
			                "edited_berths",
			                rps.getEdited_berths()
			        );
			    }

			    if (rps.getRemote_added() != null &&
			            !rps.getRemote_added().isEmpty()) {

			        body.put(
			                "remote_added",
			                rps.getRemote_added()
			        );
			    }

			    if (rps.getRemote_removed() != null &&
			            !rps.getRemote_removed().isEmpty()) {

			        body.put(
			                "remote_removed",
			                rps.getRemote_removed()
			        );
			    }

			    HttpHeaders headers = new HttpHeaders();
			    headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON );
			    headers.setAccept( Arrays.asList( org.springframework.http.MediaType.APPLICATION_JSON) );

			    HttpEntity<Map<String, Object>> entity =
			            new HttpEntity<Map<String, Object>>(
			                    body,
			                    headers
			            );

			    long sMillis = new Date().getTime();

			    ResponseEntity<String> response =
			            result.postForEntity(
			                    uri,
			                    entity,
			                    String.class,
			                    uriParams
			            );

			    long eMillis = new Date().getTime();

			    ObjectMapper oMapper = new ObjectMapper();

			    JsonNode reportData =
			            oMapper.readTree(response.getBody());

			    return reportData;
			}

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainProfiles")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainProfiles(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    Object[] rawParams = rps.getParams();
			    String num = rawParams != null && rawParams.length > 0 ? String.valueOf(rawParams[0]).trim() : "";
			    String siteId = rawParams != null && rawParams.length > 1 ? String.valueOf(rawParams[1]).trim() : "";

			    String requestUri =
			            "http://10.64.28.95:80/TPO/train/getProfiles/{num}?site_id={site_id}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();
			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);
			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map = new HashMap<String, String>();
			    map.put("num", num);
			    map.put("site_id", siteId);

			    ResponseEntity<String> response =
			            result.getForEntity(requestUri, String.class, map);

			    ObjectMapper oMapper = new ObjectMapper();
			    return oMapper.readTree(response.getBody());
			}

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/getTrainLoadProfile")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode getTrainLoadProfile(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    Object[] rawParams = rps.getParams();
			    String num = rawParams != null && rawParams.length > 0 ? String.valueOf(rawParams[0]).trim() : "";
			    String siteId = rawParams != null && rawParams.length > 1 ? String.valueOf(rawParams[1]).trim() : "";
			    String profileId = rawParams != null && rawParams.length > 2 ? String.valueOf(rawParams[2]).trim() : "";

			    String requestUri =
			            "http://10.64.28.95:80/TPO/train/loadProfile/{num}?site_id={site_id}&profile_id={profile_id}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();
			    rf.setReadTimeout(300000);
			    rf.setConnectTimeout(300000);
			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> map = new HashMap<String, String>();
			    map.put("num", num);
			    map.put("site_id", siteId);
			    map.put("profile_id", profileId);

			    ResponseEntity<String> response =
			            result.getForEntity(requestUri, String.class, map);

			    ObjectMapper oMapper = new ObjectMapper();
			    return oMapper.readTree(response.getBody());
			}

			@POST
			@Produces({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Consumes({ MediaType.APPLICATION_XML, MediaType.APPLICATION_JSON })
			@Path("/saveTrainProfile")
			@Transactional(dontRollbackOn = TypeOneRestController.class)
			public JsonNode saveTrainProfile(RequestParameters rps)
			        throws JsonProcessingException, IOException {

			    Object[] rawParams = rps.getParams();
			    String num = rawParams != null && rawParams.length > 0 ? String.valueOf(rawParams[0]).trim() : "";
			    String siteId = rawParams != null && rawParams.length > 1 ? String.valueOf(rawParams[1]).trim() : "";
			    String profileDate = rawParams != null && rawParams.length > 2 ? String.valueOf(rawParams[2]).trim() : "";
			    String fromDate = rawParams != null && rawParams.length > 3 ? String.valueOf(rawParams[3]).trim() : "";
			    String toDate = rawParams != null && rawParams.length > 4 ? String.valueOf(rawParams[4]).trim() : "";
			    String profileId = rawParams != null && rawParams.length > 5 ? String.valueOf(rawParams[5]).trim() : "";
			    String userName = rawParams != null && rawParams.length > 6 ? String.valueOf(rawParams[6]).trim() : "";

			    String uri =
			            "http://10.64.28.95:80/TPO/train/train/saveProfile/{num}";

			    SimpleClientHttpRequestFactory rf =
			            new SimpleClientHttpRequestFactory();
			    RestTemplate result = new RestTemplate(rf);

			    HashMap<String, String> uriParams = new HashMap<String, String>();
			    uriParams.put("num", num);

			    Map<String, Object> body = new HashMap<String, Object>();
			    body.put("site_id", siteId);
			    body.put("profile_date", profileDate);
			    body.put("start_date", fromDate);
			    body.put("end_date", toDate);
			    body.put("profile_id", profileId);
			    body.put("primes_id", userName);
			    body.put("edited_berths",
			            rps.getEdited_berths() != null ? rps.getEdited_berths() : new HashMap<String, Object>());
			    body.put("remote_added",
			            rps.getRemote_added() != null ? rps.getRemote_added() : new ArrayList<Object>());
			    body.put("remote_removed",
			            rps.getRemote_removed() != null ? rps.getRemote_removed() : new ArrayList<Object>());

			    HttpHeaders headers = new HttpHeaders();
			    headers.setContentType(org.springframework.http.MediaType.APPLICATION_JSON);
			    headers.setAccept(Arrays.asList(org.springframework.http.MediaType.APPLICATION_JSON));

			    HttpEntity<Map<String, Object>> entity =
			            new HttpEntity<Map<String, Object>>(body, headers);

			    ResponseEntity<String> response =
			            result.postForEntity(uri, entity, String.class, uriParams);

			    ObjectMapper oMapper = new ObjectMapper();
			    return oMapper.readTree(response.getBody());
			}
}
